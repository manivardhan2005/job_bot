# Aura FormFill – My Personal AI Job Agent 🚀

Hi there! I built this Chrome extension because I was honestly exhausted by how tedious modern job applications are. It feels like we spend 30 minutes copy-pasting the same resume details and answering "Why do you want to work here?" for every single company.

Since companies are using AI to filter us out, I decided we should use AI to apply. 

This is my personal tool that uses the **Groq API** (which is ridiculously fast and has a great free tier) to automatically fill out job application forms. It handles both the boring stuff (name, email) and the hard stuff (AI-generated cover letter snippets based on your resume).

---

## 💡 How It Works

It isn't just a basic Chrome autofill. Here's what it does under the hood:
1. **Local Regex Fill**: It instantly fills basic fields (name, email, github links) directly from your stored profile without making any API calls to save time.
2. **AI Subjective Fill**: For harder questions, it reads your resume and uses Groq's **Llama 3** models to craft a tailored answer for that specific role.
3. **Vision AI Fallback**: If the job portal is really weird (like Workday) and has hidden field labels, it can optionally take a screenshot of the form and use Groq's Vision model `llama-3.2-90b-vision-preview` to figure out what the field is asking for.

It works on Greenhouse, Lever, Workday, Ashby, standard Google Forms, and pretty much anywhere else.

---

## 🛠️ How to Install & Use It

Since this is just a personal project, it's not on the Chrome Web Store. You have to load it manually (it takes 2 minutes):

### 1. Load the Extension
1. Download or clone this repository to your computer.
2. Open Chrome/Edge and go to `chrome://extensions/` (or `edge://extensions/`).
3. Turn on **Developer Mode** (usually a toggle in the top right).
4. Click **"Load unpacked"** and select this folder.
5. You should now see the Aura FormFill icon in your browser toolbar!

### 2. Set Up Your Groq Key
1. Go to [console.groq.com/keys](https://console.groq.com/keys) and create a free API Key (it will start with `gsk_`).
2. Click the extension icon in your toolbar, go to the **Settings** tab, and paste your key.
3. Fill out your details in the Personal, Career, and Resume tabs so the AI knows who you are. Hit **Save Profile**.

### 3. Apply!
1. Go to any job application page.
2. Click the extension icon and hit **Start AI Agent**.
3. Watch it fill the fields! 
4. **Important**: Always review what the AI wrote before hitting submit to make sure it sounds like you.

---

## 🔒 Privacy

I built this for myself, so privacy was the main goal. 
- **No servers**: There is no backend server. 
- **Local Storage**: All your resume details and personal info stay strictly in your browser's local storage.
- **Direct API Calls**: The extension talks directly to the Groq API from your browser. Your API key remains entirely yours.

Feel free to fork this, tweak the prompts, and make it your own. Happy job hunting!
