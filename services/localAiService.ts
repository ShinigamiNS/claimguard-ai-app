import { ClaimExtraction, VerificationResult, PolicyDocument } from "../types";
import { verifyClaimEligibility } from "./geminiService";

// Helper to safely access globals
const getTf = () => {
  if (typeof (window as any).tf === 'undefined') {
    throw new Error("TensorFlow.js library not loaded. If you are offline, Step 1 (Local) requires cached resources or internet connection to load the library initially.");
  }
  return (window as any).tf;
};

const getUse = () => {
  if (typeof (window as any).use === 'undefined') {
    throw new Error("Universal Sentence Encoder library not loaded. Please check your internet connection.");
  }
  return (window as any).use;
};

let useModel: any = null;
let customModel: any = null;
let wordIndex: Record<string, number> | null = null; // Store vocabulary from assets
let idx2tag: Record<string, string> | null = null;   // Store tag map from assets

// Fallback Tags (Only used if model_assets.json is missing)
const BASE_LABELS = [
  "Airline/Hotel Name", "Approved Amount", "Assessment Report Summary", "Claim Amount",
  "Claim Cause", "Claim Submission Date", "Disease", "Estimated Loss Value",
  "Garage Name", "Hospital Name", "Hospital Stay Duration", "Incident Description",
  "Part Damaged", "Policy Duration", "Policy Name", "Property Damage Type",
  "Reason for Claim", "Reimbursement Type", "Repair Estimate", "Room Type",
  "Settlement Date", "Travel Claim Type", "Treatment Type", "Trip Destination",
  "Vehicle Type"
];
const RAW_TAGS = ["O"];
BASE_LABELS.forEach(l => {
    RAW_TAGS.push(`B-${l}`);
    RAW_TAGS.push(`I-${l}`);
});
const NER_TAGS = RAW_TAGS.sort();

/**
 * Load a custom model directly from user uploaded files (browser-side only).
 * Handles: model.json, multiple .bin shards, and optional model_assets.json for vocabulary.
 */
export const loadCustomModelFromFiles = async (modelFiles: FileList | File[], explicitAssetsFile?: File | null) => {
    const tf = getTf();
    await tf.ready(); 
    
    const fileArray = Array.isArray(modelFiles) ? modelFiles : Array.from(modelFiles);
    
    // 1. Identify Files
    const jsonFiles = fileArray.filter(f => f.name.toLowerCase().endsWith('.json'));
    const binFiles = fileArray.filter(f => f.name.toLowerCase().endsWith('.bin'));

    // Heuristic: model.json usually doesn't have 'assets' in name.
    const modelJsonFile = jsonFiles.find(f => !f.name.toLowerCase().includes('assets')) || jsonFiles[0];
    
    // Determine Assets File: Explicit > Heuristic in list > None
    let assetsFile = explicitAssetsFile;
    if (!assetsFile) {
        assetsFile = jsonFiles.find(f => f.name.toLowerCase().includes('assets'));
    }

    if (!modelJsonFile) {
        throw new Error("Missing model topology file (model.json).");
    }
    if (binFiles.length === 0) {
        throw new Error("Missing binary weights. Please include all .bin files.");
    }

    console.log(`Loading Model: ${modelJsonFile.name}, Weights: ${binFiles.length} files`);

    // 2. Load Assets (Vocabulary & Tags)
    if (assetsFile) {
        try {
            const text = await assetsFile.text();
            const assets = JSON.parse(text);
            if (assets.word_index) {
                wordIndex = assets.word_index;
            }
            if (assets.idx2tag) {
                idx2tag = assets.idx2tag;
                console.log(`Assets loaded! Vocab: ${Object.keys(wordIndex || {}).length}, Tags: ${Object.keys(idx2tag || {}).length}`);
            }
        } catch (e) {
            console.warn("Failed to parse model_assets.json", e);
        }
    } else {
        console.warn("No model_assets.json found. Using fallback tags and dummy tokenization.");
        wordIndex = null;
        idx2tag = null;
    }

    // 3. Load Model (Layers or Graph)
    try {
        // Try Layers Model first (Keras export)
        customModel = await tf.loadLayersModel(tf.io.browserFiles(fileArray));
        console.log("Success: Custom Layers Model loaded!");
        return customModel;
    } catch (layersError: any) {
        console.warn("loadLayersModel failed, trying GraphModel...", layersError.message);
        try {
            customModel = await tf.loadGraphModel(tf.io.browserFiles(fileArray));
            console.log("Success: Custom Graph Model loaded!");
            return customModel;
        } catch (graphError: any) {
             console.error("loadGraphModel also failed:", graphError);
             throw new Error(`Model load failed: ${graphError.message}`);
        }
    }
};

export const loadLocalModel = async () => {
  if (useModel) return useModel;
  const use = getUse();
  const tf = getTf();
  await tf.ready();
  useModel = await use.load();
  return useModel;
};

/**
 * PURE BROWSER EXTRACTION
 */
export const extractClaimDetailsLocal = async (text: string): Promise<ClaimExtraction> => {
  const tf = getTf();
  
  let keyTopics: string[] = ["General Claim"];
  let identifiedType = "Unknown Incident";
  let description = "";
  let extractedEntities: any = {
      parties: [], dates: [], locations: [], costs: [], policies: [], types: []
  };

  // --- PATH A: CUSTOM MODEL ---
  if (customModel) {
      try {
          console.log("Running Custom Model...");
          
          let inputTensor;
          let inputWords: string[] = [];
          
          // 1. INSPECT MODEL INPUT
          let requiresSequence = false;
          let seqLength = 512; // Default to 512
          let inputDtype: 'float32' | 'int32' = 'int32'; // Default to int32 for Embedding layers
          
          if (customModel.inputs && customModel.inputs[0]) {
              const inputDef = customModel.inputs[0];
              if (inputDef.shape) {
                  const shape = inputDef.shape;
                  const lastDim = shape[shape.length - 1];
                  if (lastDim && lastDim > 1) {
                      seqLength = lastDim;
                  }
                  if (seqLength > 10) requiresSequence = true;
              }
              if (inputDef.dtype) inputDtype = inputDef.dtype as any;
          }

          // 2. PREPARE INPUT (Tokenization)
          if (requiresSequence) {
             // Basic tokenization matching typical Python simple splits
             inputWords = text.match(/\b[\w']+\b|[.,!?;]/g) || text.split(/\s+/);
             inputWords = inputWords.slice(0, seqLength);
             
             const tokenIds = inputWords.map(w => {
                 if (wordIndex) {
                     // Exact lookup from loaded vocabulary
                     const token = wordIndex[w] || wordIndex[w.toLowerCase()];
                     return token || 1; // 1 is usually <OOV>
                 } else {
                     // Fallback: Dummy Hash
                     let hash = 0;
                     for (let i = 0; i < w.length; i++) hash = ((hash << 5) - hash) + w.charCodeAt(i);
                     return (Math.abs(hash) % 1000) + 1;
                 }
             });

             // Pad
             while (tokenIds.length < seqLength) {
                 tokenIds.push(0); // 0 is <PAD>
                 inputWords.push("[PAD]");
             }

             // Create Tensor
             inputTensor = tf.tensor2d([tokenIds], [1, seqLength], inputDtype); 
          } else {
             const use = await loadLocalModel();
             inputTensor = await use.embed([text]);
          }

          // 3. EXECUTE
          // Correct strategy to avoid "Cannot find SymbolicTensors" error
          let predictionOutput: any;

          // Strategy A: Keras Layers Model (predict)
          // This is the standard path for tfjs_layers_model
          if (typeof customModel.predict === 'function') {
              try {
                  predictionOutput = customModel.predict(inputTensor);
              } catch (e: any) {
                  console.warn("Predict failed, attempting fallback:", e.message);
                  // Retry with float32 if int32 failed (sometimes happens with specific layer configs)
                  if (e.message && e.message.includes("dtype")) {
                     predictionOutput = customModel.predict(inputTensor.cast('float32'));
                  } else {
                     throw e;
                  }
              }
          } 
          // Strategy B: Graph Model (executeAsync)
          else if (typeof customModel.executeAsync === 'function') {
               // For GraphModels, we usually need named inputs.
               // Try to infer input name
               const inputName = customModel.inputs?.[0]?.name || customModel.inputNodes?.[0];
               const inputMap: any = {};
               if (inputName) inputMap[inputName] = inputTensor;
               
               try {
                  predictionOutput = await customModel.executeAsync(inputMap);
               } catch (e) {
                   // Fallback: try passing tensor array directly
                   predictionOutput = await customModel.executeAsync([inputTensor]);
               }
          } else {
              throw new Error("Model has no predict or executeAsync method.");
          }
          
          // Normalize Output (Handle array output)
          if (Array.isArray(predictionOutput)) predictionOutput = predictionOutput[0];
          else if (predictionOutput && !predictionOutput.shape && predictionOutput instanceof Object && !predictionOutput.data) {
             const keys = Object.keys(predictionOutput);
             if (keys.length > 0) predictionOutput = predictionOutput[keys[0]];
          }

          const outputShape = predictionOutput.shape; // e.g., [1, 512, 26]
          
          // 4. DECODE OUTPUT (NER)
          if (outputShape.length === 3) {
              const indicesBuffer = await predictionOutput.argMax(-1).data();
              const indices = Array.from(indicesBuffer);

              // Use loaded idx2tag if available, otherwise fallback
              const getTag = (idx: number) => {
                  if (idx2tag) return idx2tag[idx.toString()] || 'O';
                  return NER_TAGS[idx] || 'O';
              };

              const foundTopicsSet = new Set<string>();
              let currentEntity = "";
              let currentTagType = "";
              
              // Domain Classification Scoring
              const domainScores = {
                  "Medical / Health Claim": 0,
                  "Motor / Auto Claim": 0,
                  "Travel Insurance Claim": 0,
                  "Home / Property Claim": 0
              };

              for (let i = 0; i < inputWords.length; i++) {
                  const word = inputWords[i];
                  const tag = getTag(indices[i] as number);
                  
                  if (word === "[PAD]") break; 

                  if (tag.startsWith("B-")) {
                      if (currentEntity) addToExtraction(extractedEntities, currentTagType, currentEntity);
                      currentTagType = tag.substring(2); 
                      currentEntity = word;
                  } else if (tag.startsWith("I-") && currentTagType === tag.substring(2)) {
                      currentEntity += " " + word;
                  } else {
                      if (currentEntity) {
                          addToExtraction(extractedEntities, currentTagType, currentEntity);
                          currentEntity = "";
                          currentTagType = "";
                      }
                  }
                  
                  if (tag !== 'O') {
                      foundTopicsSet.add(`${tag.replace('B-', '').replace('I-', '')}: ${word}`);
                      
                      // Scoring Logic
                      const t = tag.toLowerCase();
                      if (t.includes("hospital") || t.includes("disease") || t.includes("treatment") || t.includes("room")) domainScores["Medical / Health Claim"] += 2;
                      if (t.includes("vehicle") || t.includes("garage") || t.includes("part") || t.includes("repair")) domainScores["Motor / Auto Claim"] += 2;
                      if (t.includes("trip") || t.includes("travel") || t.includes("airline") || t.includes("hotel")) domainScores["Travel Insurance Claim"] += 2;
                      if (t.includes("property") || t.includes("loss") || t.includes("assessment")) domainScores["Home / Property Claim"] += 2;
                  }
              }
              if (currentEntity) addToExtraction(extractedEntities, currentTagType, currentEntity);

              keyTopics = Array.from(foundTopicsSet).slice(0, 15);
              if (keyTopics.length === 0) keyTopics = ["No Entities Found"];
              
              if (extractedEntities.locations.length > 0) extractedEntities.locationStr = extractedEntities.locations.join(", ");
              
              // Determine Incident Type based on highest score
              let maxScore = 0;
              Object.entries(domainScores).forEach(([domain, score]) => {
                  if (score > maxScore) {
                      maxScore = score;
                      identifiedType = domain;
                  }
              });
              if (maxScore === 0 && extractedEntities.types.length > 0) identifiedType = extractedEntities.types[0];

              description = `Extracted entities using Custom Model. Classified as: ${identifiedType}`;

          } else {
              // Fallback for Classification
              const resultData = await predictionOutput.data();
              identifiedType = "Classification Result";
              keyTopics = Array.from(resultData).map((v:any, i) => `Class ${i}: ${v.toFixed(2)}`);
          }

      } catch (e: any) {
          console.warn("Custom model error:", e);
          identifiedType = "Model Error";
          description = `Error: ${e.message}`;
          keyTopics = ["Execution Failed"];
      }
      
      return {
        incident_type: identifiedType,
        incident_date: extractedEntities.dates[0] || 'Not specified',
        location: extractedEntities.locations.join(", ") || 'Not specified',
        involved_parties: extractedEntities.parties.length > 0 ? extractedEntities.parties : ['Unknown'],
        damage_description: description,
        key_topics: keyTopics,
        estimated_cost: extractedEntities.costs[0] || "Not specified"
      };
  } 
  
  // --- PATH B: USE Fallback ---
  try {
      const model = await loadLocalModel();
      const textEmbedding = await model.embed([text]);
      keyTopics = ["General Claim"]; 
      identifiedType = "General Incident";
  } catch (error) {}

  return {
    incident_type: identifiedType,
    incident_date: 'Not specified',
    location: 'Not specified',
    involved_parties: ['Unknown'],
    damage_description: description,
    key_topics: keyTopics,
    estimated_cost: "Not specified"
  };
};

function addToExtraction(container: any, type: string, value: string) {
    const t = type.toLowerCase();
    if (t.includes("claimant") || t.includes("name") || t.includes("hospital") || t.includes("garage") || t.includes("airline")) container.parties.push(value);
    if (t.includes("date")) container.dates.push(value);
    if (t.includes("location") || t.includes("destination")) container.locations.push(value);
    if (t.includes("amount") || t.includes("cost") || t.includes("value") || t.includes("estimate")) container.costs.push(value);
    if (t.includes("policy")) container.policies.push(value);
    if (t.includes("type") || t.includes("cause")) container.types.push(value);
}

export const verifyClaimEligibilityLocal = async (extraction: ClaimExtraction, documents: PolicyDocument[], originalText: string): Promise<VerificationResult> => {
   if (!navigator.onLine) {
    return {
      is_eligible: false, policy_matched: "N/A", confidence_score: 0,
      reasoning: "⚠️ Offline Mode: Verification requires internet.", suggested_policy: "Offline"
    };
  }
  return verifyClaimEligibility(extraction, documents);
};