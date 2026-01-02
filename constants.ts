import { PolicyDocument } from "./types";

const SAMPLE_TEXT = `
1. **AutoGuard Standard (Policy #AG-101)**
   - **Coverage:** Private passenger vehicles.
   - **Covered Incidents:** Collision, Comprehensive (theft, fire, vandalism), Liability.
   - **Exclusions:** Commercial use, racing, intentional damage, driving under influence.
   - **Deductible:** $500.

2. **HomeShield Plus (Policy #HS-202)**
   - **Coverage:** Residential single-family homes.
   - **Covered Incidents:** Fire, windstorm, theft, liability on property, water damage (sudden/accidental).
   - **Exclusions:** Flood (requires separate policy), earthquake, wear and tear, pest infestation.
   - **Deductible:** $1000.

3. **TravelSafe Global (Policy #TG-303)**
   - **Coverage:** International travel for up to 90 days.
   - **Covered Incidents:** Medical emergencies, trip cancellation, lost luggage, flight delay > 12 hours.
   - **Exclusions:** Pre-existing conditions, high-risk sports (skydiving, etc.), travel to sanctioned countries.

4. **BizSecure Commercial (Policy #BZ-404)**
   - **Coverage:** Small business operations.
   - **Covered Incidents:** Commercial vehicle accidents, professional liability, business interruption.
   - **Exclusions:** Employee fraud, cyber attacks (requires rider).
`;

export const SAMPLE_DOCUMENTS: PolicyDocument[] = [
  {
    id: 'default-sample',
    name: 'Standard_Coverage_Policies_v1.txt',
    type: 'text',
    content: SAMPLE_TEXT,
    mimeType: 'text/plain'
  }
];

export const SAMPLE_CLAIM_TEXT = `I am submitting a health insurance claim of around  Rs 48500 under my ShieldPlus Health Plan, which is active for a period of three years from 2022 to 2025. I was hospitalized due to dengue fever after persistent high fever and weakness. I was admitted to City MultiCare Hospital on 12 June 2024 and discharged on 16 June 2024 after four nights in a shared room. The treatment included blood tests, IV fluids, and continuous monitoring. This was a cashless claim submitted on 17 June 2024, and the final settlement was completed on 5 July 2024.
`;

export const DEMO_SCENARIOS = [
  {
    id: 'valid-auto',
    label: 'Claim 1',
    text: `I am submitting a health insurance claim of around  Rs 48500 under my ShieldPlus Health Plan, which is active for a period of three years from 2022 to 2025. I was hospitalized due to dengue fever after persistent high fever and weakness. I was admitted to City MultiCare Hospital on 12 June 2024 and discharged on 16 June 2024 after four nights in a shared room. The treatment included blood tests, IV fluids, and continuous monitoring. This was a cashless claim submitted on 17 June 2024, and the final settlement was completed on 5 July 2024.`
  },
  {
    id: 'invalid-home',
    label: 'Claim 2',
    text: `This motor claim is related to a commercial delivery van insured under a Commercial Vehicle Insurance policy active from 2022 to 2025. The claim amount requested was around  Rs 340000. The van met with a highway accident involving another vehicle, resulting in major damage to the chassis and engine components. Repairs were carried out at Highway Auto Works after inspection by the surveyor. The repair estimate was revised twice due to additional damage found later. I submitted the claim shortly after the accident and the settlement was completed after detailed assessment.`
  },
  {
    id: 'valid-travel',
    label: 'Claim 3',
    text: `I raised a travel insurance claim of  Rs 19000 under my Travel Secure Gold policy for hotel overbooking issues during my Europe tour. Upon arrival, the hotel informed us that no rooms were available due to system error. I had to arrange alternate accommodation at a higher cost. The trip duration was from 2 June to 15 June 2024. I submitted hotel confirmation emails, alternate booking bills, and payment proofs. The insurer reviewed the case and settled the claim as per sub-limits mentioned in the policy.`
  }
];