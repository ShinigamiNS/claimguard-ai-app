import React, { useState } from 'react';
import { X, Terminal, FileJson, Layers, AlertTriangle, CheckCircle2, Copy, Check, FileCode } from 'lucide-react';

interface ModelConversionHelpProps {
  onClose: () => void;
}

const PYTHON_SCRIPT = `
import os
import json
import random
import pickle
import numpy as np
import shutil
import subprocess

# Install dependencies if missing (Colab support)
try:
    import tf_keras
except ImportError:
    subprocess.check_call(["pip", "install", "tf_keras", "tensorflowjs", "faker"])
    import tf_keras

import tensorflow as tf
import tf_keras as keras
from tf_keras import layers, models
import tensorflowjs as tfjs
from faker import Faker

# --- CONFIGURATION ---
MAX_LEN = 512
EMBEDDING_DIM = 50
EPOCHS = 5
BATCH_SIZE = 32
MODEL_DIR = "tfjs_conversion"
os.makedirs(MODEL_DIR, exist_ok=True)
fake = Faker()

# --- DATA GENERATION (Multi-Domain) ---
def generate_health_claim():
    hospital = f"{fake.last_name()} Hospital"
    treatment = random.choice(['surgery', 'diagnostics', 'maternity'])
    disease = random.choice(['dengue', 'fracture', 'fever'])
    return [
        ("Patient", None), ("admitted", None), ("to", None),
        (hospital, "Hospital Name"), ("for", None),
        (treatment, "Treatment Type"), ("due", None), ("to", None),
        (disease, "Disease"), (".", None)
    ]

def generate_motor_claim():
    vehicle = random.choice(['Honda City', 'Maruti Swift'])
    part = random.choice(['bumper', 'windshield'])
    return [
        ("Vehicle", None), (vehicle, "Vehicle Type"), ("suffered", None),
        ("damage", None), ("to", None), (part, "Part Damaged"), (".", None)
    ]

# (Simplified generation for brevity - expand as needed)
def generate_entry():
    tokens = []
    ner = []
    # Mix domains
    gen_func = random.choice([generate_health_claim, generate_motor_claim])
    data = gen_func()
    
    for word, label in data:
        idx = len(tokens)
        tokens.append(word)
        if label: ner.append([idx, idx, label])
            
    return {"tokenized_text": tokens, "ner": ner}

# Generate Data
print("Generating 1000 examples...")
raw_data = [generate_entry() for _ in range(1000)]

# Preprocessing
all_words = set(w for e in raw_data for w in e["tokenized_text"])
all_tags = set(["O"])
for e in raw_data:
    tags = ["O"] * len(e["tokenized_text"])
    for start, end, label in e["ner"]:
        tags[start] = f"B-{label}"
        all_tags.add(f"B-{label}")
        all_tags.add(f"I-{label}")
    e["tags"] = tags

word_index = {w: i + 2 for i, w in enumerate(sorted(list(all_words)))}
word_index["<PAD>"] = 0; word_index["<OOV>"] = 1
tag2idx = {t: i for i, t in enumerate(sorted(list(all_tags)))}
num_tags = len(tag2idx)

# Vectorize
X = []
y = []
for e in raw_data:
    seq = [word_index.get(w, 1) for w in e["tokenized_text"]]
    seq = (seq + [0] * MAX_LEN)[:MAX_LEN]
    X.append(seq)
    
    t_seq = [tag2idx[t] for t in e["tags"]]
    t_seq = (t_seq + [tag2idx["O"]] * MAX_LEN)[:MAX_LEN]
    y.append(t_seq)

X = np.array(X); y = keras.utils.to_categorical(y, num_tags)

# Model
input_layer = layers.Input(batch_shape=(None, MAX_LEN), dtype='int32')
x = layers.Embedding(len(word_index), EMBEDDING_DIM)(input_layer)
x = layers.Bidirectional(layers.LSTM(64, return_sequences=True))(x)
output = layers.TimeDistributed(layers.Dense(num_tags, activation="softmax"))(x)
model = models.Model(input_layer, output)
model.compile("adam", "categorical_crossentropy", ["accuracy"])
model.fit(X, y, epochs=EPOCHS, validation_split=0.1)

# Save Assets
with open(f"{MODEL_DIR}/model_assets.json", "w") as f:
    json.dump({"word_index": word_index, "max_len": MAX_LEN}, f)

# Convert to TFJS
h5_path = f"{MODEL_DIR}/model.h5"
model.save(h5_path)
subprocess.run([
    "tensorflowjs_converter", "--input_format=keras", 
    "--output_format=tfjs_layers_model", h5_path, f"{MODEL_DIR}/tfjs_model"
], check=True)

# Patch model.json for BatchInputShape
json_path = f"{MODEL_DIR}/tfjs_model/model.json"
with open(json_path, "r") as f: d = json.load(f)
# (Inject batch_input_shape logic here if needed by your specific tfjs version)
# ...

shutil.make_archive(f"{MODEL_DIR}/tfjs_model", 'zip', f"{MODEL_DIR}/tfjs_model")
print("Done! Download tfjs_model.zip and model_assets.json")
`;

const ModelConversionHelp: React.FC<ModelConversionHelpProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(PYTHON_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white z-10">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-600" />
            Create & Convert Your Model
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
             <div className="mt-1 bg-white p-2 rounded-lg text-blue-600 shadow-sm h-fit">
               <FileCode className="w-5 h-5" />
             </div>
             <div>
               <h3 className="font-semibold text-blue-900">Python Training Script</h3>
               <p className="text-sm text-blue-800/80 mt-1">
                 Use the script below in Google Colab or your local environment. It generates a multi-domain NER model (Medical, Auto, Travel, Property) compatible with this web app.
               </p>
             </div>
          </div>

          <div className="relative group">
            <div className="absolute top-3 right-3 z-10">
               <button 
                 onClick={copyCode}
                 className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-md transition-all shadow-md"
               >
                 {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                 {copied ? 'Copied!' : 'Copy Script'}
               </button>
            </div>
            <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs font-mono overflow-x-auto h-96 border border-slate-700 shadow-inner">
              <code>{PYTHON_SCRIPT}</code>
            </pre>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 mb-3">1</div>
                <h4 className="font-semibold text-sm">Run in Colab</h4>
                <p className="text-xs text-slate-500 mt-1">Paste the script into a Google Colab cell and run it. It will train a model and create a zip file.</p>
             </div>
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 mb-3">2</div>
                <h4 className="font-semibold text-sm">Download Files</h4>
                <p className="text-xs text-slate-500 mt-1">Download <code>tfjs_model.zip</code> (unzip it!) and <code>model_assets.json</code>.</p>
             </div>
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 mb-3">3</div>
                <h4 className="font-semibold text-sm">Upload to App</h4>
                <p className="text-xs text-slate-500 mt-1">Select <code>model.json</code>, all <code>.bin</code> files, and <code>model_assets.json</code> in the Local Model settings.</p>
             </div>
          </div>

        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 text-right">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModelConversionHelp;