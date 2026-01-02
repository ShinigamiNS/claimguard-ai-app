import { GoogleGenAI, Type, Part, Content } from "@google/genai";
import { ClaimExtraction, VerificationResult, PolicyDocument } from "../types";

// Helper to get the AI client lazily
// This prevents the app from crashing at startup if the API_KEY is missing
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing in environment variables.");
    throw new Error("API Key is missing. Please check your configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Helper to construct parts from the entire Knowledge Base (multiple documents)
 */
const getKnowledgeBaseParts = (documents: PolicyDocument[]): Part[] => {
  const parts: Part[] = [];
  
  documents.forEach(doc => {
    if (doc.type === 'file') {
      parts.push({
        inlineData: {
          mimeType: doc.mimeType,
          data: doc.content
        }
      });
    } else {
      parts.push({
        text: `\n--- Document: ${doc.name} ---\n${doc.content}\n----------------\n`
      });
    }
  });
  
  return parts;
};

/**
 * Helper to clean and parse JSON from model response.
 * Handles Markdown code blocks and empty whitespace.
 */
const cleanAndParseJson = <T>(text: string | undefined, fallback: T): T => {
  if (!text) return fallback;
  
  let clean = text.trim();
  
  // Remove markdown code blocks (```json ... ```)
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?/, "").replace(/```$/, "");
  }
  
  clean = clean.trim();
  
  if (!clean) return fallback;
  
  try {
    return JSON.parse(clean) as T;
  } catch (e) {
    console.error("JSON Parse Error. Raw Text:", text, "Cleaned Text:", clean);
    // If simple parse fails, try to find the first '{' and last '}'
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
       const substring = clean.substring(firstBrace, lastBrace + 1);
       try {
         return JSON.parse(substring) as T;
       } catch (innerError) {
         console.error("Substring JSON Parse Error:", innerError);
       }
    }
    throw new Error("Failed to parse model response as JSON.");
  }
};

export interface ClaimInput {
  text: string;
  file?: {
    mimeType: string;
    data: string; // Base64
  };
}

/**
 * Step 1: Extraction Model
 * Uses gemini-2.5-flash.
 * Injects ALL knowledge base documents + Claim Evidence (Text/Image/PDF).
 */
export const extractClaimDetails = async (input: ClaimInput, documents: PolicyDocument[]): Promise<ClaimExtraction> => {
  const ai = getAiClient();
  const modelId = "gemini-2.5-flash";
  
  const extractionSchema = {
    type: Type.OBJECT,
    properties: {
      incident_type: { type: Type.STRING, description: "Type of incident (e.g., Car Accident, House Fire)" },
      incident_date: { type: Type.STRING, description: "Date of the incident" },
      location: { type: Type.STRING, description: "Location where it happened" },
      involved_parties: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "Names of people involved" 
      },
      damage_description: { type: Type.STRING, description: "Summary of the damage visible in evidence or described" },
      estimated_cost: { type: Type.STRING, description: "Estimated cost if mentioned" },
      key_topics: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "Key topics extracted from the claim evidence that are specifically relevant to the provided Knowledge Base context."
      }
    },
    required: ["incident_type", "damage_description", "key_topics"]
  };

  try {
    const parts: Part[] = [];

    // 1. Add System Instruction / Context Setup
    parts.push({
      text: `You are an insurance data extraction specialist.
      
      You have access to the following Reference Policy Documents (Knowledge Base).
      Use these documents to understand what information is "relevant" or "required" for a claim.`
    });

    // 2. Add All Knowledge Base Documents
    parts.push(...getKnowledgeBaseParts(documents));

    // 3. Add Claim Evidence (File) if present
    if (input.file) {
      parts.push({
        inlineData: {
          mimeType: input.file.mimeType,
          data: input.file.data
        }
      });
    }

    // 4. Add Claim Text and Task
    parts.push({
        text: `Task: Analyze the provided claim evidence (text description and/or attached files). Identify key topics and facts that are specifically relevant or required based on the Reference Policy Documents provided above.
        
        If an image is provided, describe the visible damage relevant to the claim.

        Claim Description / Notes:
        "${input.text}"`
    });

    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: extractionSchema,
        temperature: 0.1,
      }
    });

    return cleanAndParseJson<ClaimExtraction>(response.text, {} as ClaimExtraction);

  } catch (error) {
    console.error("Extraction failed:", error);
    throw new Error("Failed to extract claim details.");
  }
};

/**
 * Step 2: Verification Model
 * Uses gemini-2.5-flash with Thinking Config enabled.
 * This ensures high reasoning capabilities (similar to Pro) while maintaining high rate limits.
 */
export const verifyClaimEligibility = async (extraction: ClaimExtraction, documents: PolicyDocument[]): Promise<VerificationResult> => {
  const ai = getAiClient();
  const modelId = "gemini-2.5-flash";

  const verificationSchema = {
    type: Type.OBJECT,
    properties: {
      is_eligible: { type: Type.BOOLEAN, description: "Is the claim eligible under any of the provided policy documents?" },
      policy_matched: { type: Type.STRING, description: "The specific Policy Name and Section that covers this" },
      reasoning: { type: Type.STRING, description: "Detailed explanation referencing specific terms from the Knowledge Base" },
      suggested_policy: { type: Type.STRING, description: "If ineligible, suggest which type of insurance from the Knowledge Base might apply, or 'None'" },
      confidence_score: { type: Type.NUMBER, description: "Confidence score between 0 and 1" }
    },
    required: ["is_eligible", "reasoning", "confidence_score"]
  };

  const parts: Part[] = [];

  parts.push({
    text: `You are a senior insurance underwriter agent.
    
    You have access to the following Reference Policy Documents (Knowledge Base).`
  });

  parts.push(...getKnowledgeBaseParts(documents));

  parts.push({
    text: `Here are the extracted details from a new claim:
    ${JSON.stringify(extraction, null, 2)}

    Task:
    1. Analyze the claim details STRICTLY against the Reference Policy Documents provided above.
    2. Determine if the claim is eligible for coverage under ANY of the documents.
    3. Check for any exclusions mentioned in the matched policy.
    4. Provide reasoning based only on the text provided in the Reference Policy Documents.
    5. If the claim is eligible, cite the specific policy name.`
  });

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: verificationSchema,
        // Enable Thinking to improve reasoning quality for complex policy logic
        // We reserve tokens for the JSON output by setting a budget.
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 2048 }
      }
    });

    return cleanAndParseJson<VerificationResult>(response.text, {} as VerificationResult);
  } catch (error) {
    console.error("Verification failed:", error);
    throw new Error("Failed to verify claim.");
  }
};

/**
 * Chatbot Interaction
 * Uses gemini-2.5-flash (switched from pro to avoid limits)
 */
export const createChatSession = (documents: PolicyDocument[]) => {
    const ai = getAiClient();
    // Construct the history with the documents pre-loaded as the first turn
    const kbParts = getKnowledgeBaseParts(documents);

    return ai.chats.create({
        model: 'gemini-2.5-flash',
        history: [
            {
                role: 'user',
                parts: [
                    { text: "Here is the Knowledge Base containing all active insurance policy documents. Please read them carefully." },
                    ...kbParts
                ]
            },
            {
                role: 'model',
                parts: [{ text: `I have read and indexed the ${documents.length} provided policy documents. I am ready to answer questions based on this Knowledge Base.` }]
            }
        ],
        config: {
            systemInstruction: `You are a helpful Insurance Assistant named "ClaimGuard AI". 
            Answer questions based ONLY on the policy documents provided in the chat history.
            If the answer is not in the documents, state that clearly.`
        }
    });
};