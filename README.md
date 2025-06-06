# Quick Start
## Installation
Here’s a step-by-step instruction guide to set up the environment you described on your laptop using **Anaconda** for environment management:

---

### ✅ **1. Create a New Anaconda Environment**

```bash
conda create -n webenv nodejs=20 openjdk=11 -c conda-forge -y
# or 
conda activate webenv
```

> This installs Node.js 20 and JAVA 11 within your new Conda environment.

---

### ✅ **3. Install Firebase CLI Globally**

```bash
npm install -g firebase-tools
```

---

### ✅ **4. Download the Project Files**

* Clone the repository or download a ZIP of the project folder and extract it.

```bash
git clone https://github.com/yguo0102/ReviewNER.git
cd ReviewNER
```

---

### ✅ **5. Install Project Dependencies**

```bash
npm install
```

---

### ✅ **6. Start Local Development Server**

```bash
npm run dev
```

---

### ✅ Optional: Add Java to PATH (if not set)

Ensure Java is on your PATH:

```bash
# macOS/Linux
export JAVA_HOME=$(/usr/libexec/java_home)
export PATH=$JAVA_HOME/bin:$PATH

# Windows: Set JAVA_HOME and update Path in Environment Variables.
```

