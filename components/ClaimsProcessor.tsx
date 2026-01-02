import React, { useState, useRef, useEffect } from 'react';
import { FileText, CheckCircle, AlertTriangle, ArrowRight, ScanSearch, FileCheck, ClipboardList, RefreshCw, Library, Upload, X, File, PlayCircle, Cpu, CloudLightning, Settings, HelpCircle, Box, FileJson, Database } from 'lucide-react';
import { SAMPLE_CLAIM_TEXT, DEMO_SCENARIOS } from '../constants';
import { extractClaimDetails, verifyClaimEligibility } from '../services/geminiService';
import { extractClaimDetailsLocal, verifyClaimEligibilityLocal, loadLocalModel, loadCustomModelFromFiles } from '../services/localAiService';
import { ClaimExtraction, VerificationResult, ProcessingStatus, PolicyDocument } from '../types';
import ModelConversionHelp from './ModelConversionHelp';

interface ClaimsProcessorProps {
  documents: PolicyDocument[];
  mode: 'cloud' | 'local';
}

interface ClaimFile {
  file: File;
  previewUrl: string | null;
  base64: string;
}

const ClaimsProcessor: React.FC<ClaimsProcessorProps> = ({ documents, mode }) => {
  const [inputText, setInputText] = useState(SAMPLE_CLAIM_TEXT);
  const [claimFile, setClaimFile] = useState<ClaimFile | null>(null);
  
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [extractionResult, setExtractionResult] = useState<ClaimExtraction | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Local Model Config State
  const [localModelReady, setLocalModelReady] = useState(false);
  const [modelSource, setModelSource] = useState<'default' | 'custom'>('default');
  const [customModelLoaded, setCustomModelLoaded] = useState(false);
  const [showModelHelp, setShowModelHelp] = useState(false);
  
  // Custom Model Upload State
  const [modelJsonFile, setModelJsonFile] = useState<File | null>(null);
  const [modelWeightsFiles, setModelWeightsFiles] = useState<File[]>([]);
  const [modelAssetsFile, setModelAssetsFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const weightsInputRef = useRef<HTMLInputElement>(null);
  const assetsInputRef = useRef<HTMLInputElement>(null);

  // Pre-load default local model
  useEffect(() => {
    if (mode === 'local' && modelSource === 'default') {
      loadLocalModel().then(() => setLocalModelReady(true));
    }
  }, [mode, modelSource]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (e.target.value) e.target.value = '';
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setModelJsonFile(e.target.files[0]);
    }
    // Reset input
    if (e.target.value) e.target.value = '';
  };

  const handleWeightsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setModelWeightsFiles(Array.from(e.target.files));
    }
    // Reset input
    if (e.target.value) e.target.value = '';
  };

  const handleAssetsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setModelAssetsFile(e.target.files[0]);
    }
    // Reset input
    if (e.target.value) e.target.value = '';
  };

  const handleLoadCustomModel = async () => {
    if (!modelJsonFile || modelWeightsFiles.length === 0) return;
    
    try {
        setStatus(ProcessingStatus.EXTRACTING); // Just to show loading state
        setErrorMsg(null);
        
        // Combine files for the loader
        const allFiles = [modelJsonFile, ...modelWeightsFiles];
        
        await loadCustomModelFromFiles(allFiles, modelAssetsFile);
        setCustomModelLoaded(true);
        setLocalModelReady(true);
    } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || "Failed to load custom model. Ensure you have selected all required files.");
        setCustomModelLoaded(false);
    } finally {
        setStatus(ProcessingStatus.IDLE);
    }
  };

  const processFile = (file: File) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!validTypes.includes(file.type)) {
      alert("Unsupported file type. Please upload PDF or Images (JPEG, PNG).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(',')[1];
      const isImage = file.type.startsWith('image/');
      setClaimFile({
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : null,
        base64
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    setClaimFile(null);
  };

  const handleProcess = async () => {
    if (!inputText.trim() && !claimFile) {
      setErrorMsg("Please provide text description or upload evidence.");
      return;
    }
    if (documents.length === 0) {
        setErrorMsg("Please add at least one policy document to the Knowledge Base.");
        return;
    }
    
    setStatus(ProcessingStatus.EXTRACTING);
    setErrorMsg(null);
    setExtractionResult(null);
    setVerificationResult(null);

    try {
      let extraction: ClaimExtraction;

      if (mode === 'cloud') {
        extraction = await extractClaimDetails({
          text: inputText,
          file: claimFile ? { mimeType: claimFile.file.type, data: claimFile.base64 } : undefined
        }, documents);
      } else {
        extraction = await extractClaimDetailsLocal(inputText);
      }
      
      setExtractionResult(extraction);
      
      setStatus(ProcessingStatus.VERIFYING);
      
      let verification: VerificationResult;
      if (mode === 'cloud') {
         verification = await verifyClaimEligibility(extraction, documents);
      } else {
         verification = await verifyClaimEligibilityLocal(extraction, documents, inputText);
      }

      setVerificationResult(verification);
      setStatus(ProcessingStatus.COMPLETED);

    } catch (e) {
      console.error(e);
      setErrorMsg("An error occurred during processing. Please try again.");
      setStatus(ProcessingStatus.ERROR);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 relative">
      {showModelHelp && <ModelConversionHelp onClose={() => setShowModelHelp(false)} />}
       
      {/* Current Knowledge Base Banner */}
      <div className={`mb-8 bg-gradient-to-r rounded-xl p-4 flex items-center justify-between text-white shadow-lg transition-colors ${mode === 'cloud' ? 'from-slate-800 to-slate-900' : 'from-emerald-800 to-emerald-900'}`}>
          <div className="flex items-center gap-3">
             <div className="p-2 bg-white/10 rounded-lg">
               <Library className="w-5 h-5 text-white" />
             </div>
             <div>
               <p className="text-xs text-slate-300 font-medium uppercase tracking-wider">Active Knowledge Base</p>
               <p className="font-semibold text-sm">
                 {documents.length === 0 ? "No documents loaded" : `${documents.length} Policy Documents Indexed`}
               </p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'local' && !localModelReady && !customModelLoaded && (
               <div className="text-xs bg-white/10 px-3 py-1 rounded-full text-white animate-pulse">Loading Model...</div>
            )}
            <div className={`text-xs px-3 py-1 rounded-full border ${mode === 'cloud' ? 'bg-blue-500/20 border-blue-400 text-blue-100' : 'bg-emerald-500/20 border-emerald-400 text-emerald-100'}`}>
               {mode === 'cloud' ? 'Cloud: Gemini 1M+ Context' : `Local: ${modelSource === 'custom' ? 'Custom Keras/TF Model' : 'TF.js Universal Sentence Encoder'}`}
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Input */}
        <div className="space-y-6">
            
          {/* LOCAL MODE SETTINGS PANEL */}
          {mode === 'local' && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                  <div className="flex justify-between items-start mb-4">
                      <h3 className="text-emerald-900 font-semibold flex items-center gap-2 text-sm">
                          <Settings className="w-4 h-4" />
                          Local Model Configuration
                      </h3>
                      <button onClick={() => setShowModelHelp(true)} className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 underline">
                          <HelpCircle className="w-3 h-3" />
                          How to convert my model?
                      </button>
                  </div>
                  
                  <div className="space-y-3">
                      <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="radio" 
                                name="modelSource" 
                                checked={modelSource === 'default'} 
                                onChange={() => setModelSource('default')}
                                className="text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-sm text-emerald-900">Default (Universal Sentence Encoder)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="radio" 
                                name="modelSource" 
                                checked={modelSource === 'custom'} 
                                onChange={() => setModelSource('custom')}
                                className="text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-sm text-emerald-900">Custom Keras/TF Model</span>
                          </label>
                      </div>

                      {modelSource === 'custom' && (
                          <div className="mt-3 p-4 bg-white rounded-xl border border-emerald-200 space-y-4">
                              {/* 1. Upload JSON */}
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                         <FileJson className="w-4 h-4" />
                                     </div>
                                     <div className="flex flex-col">
                                         <span className="text-sm font-medium text-slate-800">Model Topology</span>
                                         <span className="text-xs text-slate-500">{modelJsonFile ? modelJsonFile.name : 'Select model.json'}</span>
                                     </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                     <button 
                                        onClick={() => jsonInputRef.current?.click()} 
                                        className="text-xs bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-md font-medium text-slate-600 transition-colors"
                                     >
                                        Select
                                     </button>
                                  </div>
                                  <input type="file" ref={jsonInputRef} accept=".json" className="hidden" onChange={handleJsonUpload} />
                              </div>

                              {/* 2. Upload Weights */}
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                         <Database className="w-4 h-4" />
                                     </div>
                                     <div className="flex flex-col">
                                         <span className="text-sm font-medium text-slate-800">Model Weights</span>
                                         <span className="text-xs text-slate-500">
                                            {modelWeightsFiles.length > 0 ? `${modelWeightsFiles.length} file(s) selected` : 'Select .bin shards'}
                                         </span>
                                     </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                     <button 
                                        onClick={() => weightsInputRef.current?.click()} 
                                        className="text-xs bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-md font-medium text-slate-600 transition-colors"
                                     >
                                        Select
                                     </button>
                                  </div>
                                   <input type="file" ref={weightsInputRef} accept=".bin" multiple className="hidden" onChange={handleWeightsUpload} />
                              </div>

                              {/* 3. Upload Assets */}
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                         <FileText className="w-4 h-4" />
                                     </div>
                                     <div className="flex flex-col">
                                         <span className="text-sm font-medium text-slate-800">Model Assets (Vocabulary)</span>
                                         <span className="text-xs text-slate-500">{modelAssetsFile ? modelAssetsFile.name : 'Select model_assets.json'}</span>
                                     </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                     <button 
                                        onClick={() => assetsInputRef.current?.click()} 
                                        className="text-xs bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-md font-medium text-slate-600 transition-colors"
                                     >
                                        Select
                                     </button>
                                  </div>
                                   <input type="file" ref={assetsInputRef} accept=".json" className="hidden" onChange={handleAssetsUpload} />
                              </div>
                              
                              <div className="text-xs text-slate-500 bg-emerald-50/50 p-2 rounded">
                                  <strong>Tip:</strong> You must upload <code>model.json</code> and all <code>.bin</code> files. <code>model_assets.json</code> is highly recommended for accurate text decoding.
                              </div>

                              {/* 4. Action Button */}
                              <button 
                                onClick={handleLoadCustomModel}
                                disabled={!modelJsonFile || modelWeightsFiles.length === 0}
                                className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                              >
                                {customModelLoaded ? (
                                    <>
                                        <CheckCircle className="w-4 h-4" /> Model Loaded
                                    </>
                                ) : (
                                    <>
                                        <Box className="w-4 h-4" /> Load Custom Model
                                    </>
                                )}
                              </button>
                              
                              {customModelLoaded && <p className="text-xs text-center text-emerald-600 font-medium animate-fade-in">Ready for inference!</p>}
                          </div>
                      )}
                  </div>
              </div>
          )}

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                Claim Evidence
              </h2>
            </div>
            
            {/* Quick Demo Scenarios */}
            <div className="mb-4">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Demo Scenarios</p>
               <div className="flex flex-wrap gap-2">
                 {DEMO_SCENARIOS.map(scenario => (
                   <button
                     key={scenario.id}
                     onClick={() => {
                        setInputText(scenario.text);
                        setClaimFile(null);
                        setExtractionResult(null);
                        setVerificationResult(null);
                        setStatus(ProcessingStatus.IDLE);
                     }}
                     className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 border border-slate-200"
                   >
                     <PlayCircle className="w-3 h-3" />
                     {scenario.label}
                   </button>
                 ))}
               </div>
            </div>

            {/* Text Input */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Description of Incident</label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full h-32 p-4 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none font-mono transition-all"
                placeholder="Describe what happened..."
              />
            </div>

            {/* File Input */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Supporting Documents / Images</label>
              
              {!claimFile ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 hover:border-blue-300 transition-all group"
                >
                  <Upload className="w-8 h-8 text-slate-300 group-hover:text-blue-500 mx-auto mb-2 transition-colors" />
                  <p className="text-sm text-slate-600 font-medium">Upload Evidence</p>
                  <p className="text-xs text-slate-400 mt-1">PDF Documents or Images (JPG, PNG)</p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="relative bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                   {claimFile.previewUrl ? (
                     <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-300">
                        <img src={claimFile.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                     </div>
                   ) : (
                     <div className="w-12 h-12 rounded-lg bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0 border border-red-100">
                        <File className="w-6 h-6" />
                     </div>
                   )}
                   <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{claimFile.file.name}</p>
                      <p className="text-xs text-slate-500">{(claimFile.file.size / 1024 / 1024).toFixed(2)} MB</p>
                   </div>
                   <button 
                    onClick={handleRemoveFile}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                   >
                     <X className="w-5 h-5" />
                   </button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                onClick={() => { setInputText(''); setClaimFile(null); }} 
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-medium"
              >
                Clear All
              </button>
              <button
                onClick={handleProcess}
                disabled={(status === ProcessingStatus.EXTRACTING || status === ProcessingStatus.VERIFYING) || (mode === 'local' && !localModelReady)}
                className={`px-6 py-2 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${mode === 'cloud' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              >
               {(status === ProcessingStatus.EXTRACTING || status === ProcessingStatus.VERIFYING) ? (
                 <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Processing...
                 </>
               ) : (
                 <>
                  {mode === 'cloud' ? <CloudLightning className="w-4 h-4" /> : <Cpu className="w-4 h-4" />} 
                  {mode === 'cloud' ? 'Process via Cloud' : 'Process Locally'}
                 </>
               )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="space-y-6">
          
          {/* Step 1 Result: Extraction */}
          <div className={`transition-all duration-500 ${status !== ProcessingStatus.IDLE ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-4 blur-sm grayscale'}`}>
            <div className={`bg-white rounded-2xl shadow-sm border ${status === ProcessingStatus.EXTRACTING ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'} overflow-hidden`}>
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <ScanSearch className="w-4 h-4 text-emerald-600" />
                  Step 1: Extracted Data
                </h3>
                {status === ProcessingStatus.EXTRACTING && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full animate-pulse">Analyzing Evidence...</span>}
              </div>
              
              {extractionResult ? (
                <div className="p-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2 sm:col-span-1">
                    <span className="block text-xs text-slate-400 uppercase tracking-wider font-semibold">Incident Type</span>
                    <span className="font-medium text-slate-900">{extractionResult.incident_type}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="block text-xs text-slate-400 uppercase tracking-wider font-semibold">Date</span>
                    <span className="font-medium text-slate-900">{extractionResult.incident_date}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-xs text-slate-400 uppercase tracking-wider font-semibold">Key Topics</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {extractionResult.key_topics.map(topic => (
                        <span key={topic} className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs border border-emerald-100">{topic}</span>
                      ))}
                    </div>
                  </div>
                   <div className="col-span-2">
                    <span className="block text-xs text-slate-400 uppercase tracking-wider font-semibold">Description / Findings</span>
                    <p className="text-slate-600 mt-1 text-sm bg-slate-50 p-2 rounded border border-slate-100">{extractionResult.damage_description}</p>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm">
                  Waiting for input processing...
                </div>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
             <ArrowRight className={`w-6 h-6 text-slate-300 transform rotate-90 lg:rotate-0 transition-colors duration-300 ${status === ProcessingStatus.VERIFYING || status === ProcessingStatus.COMPLETED ? 'text-blue-500' : ''}`} />
          </div>

          {/* Step 2 Result: Verification */}
          <div className={`transition-all duration-500 delay-100 ${verificationResult ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-4 blur-sm grayscale'}`}>
            <div className={`bg-white rounded-2xl shadow-sm border ${status === ProcessingStatus.VERIFYING ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'} overflow-hidden`}>
               <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-indigo-600" />
                  Step 2: Eligibility Check
                </h3>
                 {status === ProcessingStatus.VERIFYING && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full animate-pulse">Reasoning...</span>}
              </div>

              {verificationResult ? (
                <div className="p-6">
                  <div className={`mb-4 p-4 rounded-xl flex items-start gap-3 ${verificationResult.is_eligible ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                    {verificationResult.is_eligible ? <CheckCircle className="w-6 h-6 flex-shrink-0" /> : <AlertTriangle className="w-6 h-6 flex-shrink-0" />}
                    <div>
                      <h4 className="font-bold text-lg">{verificationResult.is_eligible ? 'Eligible for Claim' : 'Review Required / Ineligible'}</h4>
                      <p className="mt-1 text-sm opacity-90">
                        {verificationResult.is_eligible 
                          ? `Matched Policy: ${verificationResult.policy_matched}` 
                          : `Suggested Policy: ${verificationResult.suggested_policy || "None available"}`}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                     <div>
                        <span className="block text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">
                          {mode === 'cloud' ? 'AI Reasoning (GenAI)' : 'AI Reasoning (Vector Math)'}
                        </span>
                        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                          {verificationResult.reasoning}
                        </p>
                     </div>
                     
                     <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-xs font-medium text-slate-500">Confidence Score</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${verificationResult.confidence_score > 0.8 ? 'bg-green-500' : 'bg-yellow-500'}`} 
                              style={{ width: `${verificationResult.confidence_score * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-slate-700">{(verificationResult.confidence_score * 100).toFixed(0)}%</span>
                        </div>
                     </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm">
                  Analysis pending extraction...
                </div>
              )}
            </div>
          </div>

          {errorMsg && (
             <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-sm flex items-center gap-2 animate-pulse">
                <AlertTriangle className="w-4 h-4" />
                {errorMsg}
             </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ClaimsProcessor;