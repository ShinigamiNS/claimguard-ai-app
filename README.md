<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1xoD8xtfl8iBIuoqANnmt64AxrVPBdnQU

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


******************** STEPS TO Open THE App *********************************

1. Open Claimguard-ai-app folder
2. open command prompt(cmd) from the folder
3. run the command "npm install"
4. run the command "npm run dev"

the app will open in the web browser at "http://localhost:3000/" 


******************** Steps to run the App **********************************

1. Go to tab KB(1)[This will be located on the right most part of the page along side "Dashboard"]

2. Upload the policy wording documents

3. Go to Dashboard 

4. Choose Cloud Api to check for the eligibility through Cloud based LLms

5. Choose Local Models to check for eligibility through the locally trained ner model.



******************** To run the Local ner Model **********************************

1. choose Custom Keras/TF Model (option)

2. upload model.json , .bin shards, model_assets.json    


*********************** Possible Issues **************************************

1. The App is using a free tier google api, If the App is not returning a response and showing an error on the webpage, most probably the api limit has exceeded
please update the .env file inside the app with your google gemini api.


