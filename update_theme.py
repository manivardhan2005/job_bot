import os
import re
from PIL import Image

def update_css():
    html_path = r"c:\Users\maniv\OneDrive\Desktop\Downloads\ADS LAB\job-bot\formFillNinjatechnique\popup.html"
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    new_css = """  <style>
    :root{
      --bg:#0f172a;
      --s1:#1e293b;
      --s2:#0f172a;
      --s3:#334155;
      --b1:#334155;
      --b2:#475569;
      --ac:#6366f1;
      --ac2:#a5b4fc;
      --ac3:#10b981;
      --ac4:#f59e0b;
      --tx:#f8fafc;
      --td:#94a3b8;
      --tm:#cbd5e1;
    }
    *{box-sizing:border-box;margin:0;padding:0}
    body{width:480px;min-height:600px;background:var(--bg);color:var(--tx);
      font-family:'Inter', 'DM Sans', sans-serif;font-size:13px;overflow-x:hidden;}

    .hdr{background:var(--s1);padding:18px 24px;
      border-bottom:1px solid var(--b1);display:flex;align-items:center;gap:14px;}
    .logo{width:36px;height:36px;border-radius:8px;flex-shrink:0;
      background:var(--ac);
      display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;font-weight:700;}
    .htxt{flex:1}
    .htitle{font-size:18px;font-weight:700;color:var(--tx);letter-spacing:-.3px}
    .hsub{font-size:12px;color:var(--td);margin-top:2px;}
    .pill{padding:4px 10px;border-radius:20px;font-size:10px;font-weight:600;
      text-transform:uppercase;flex-shrink:0;}
    .pill.ok{background:rgba(16,185,129,.15);color:var(--ac3);}
    .pill.no{background:rgba(244,63,94,.15);color:#f43f5e;}

    .tabs{display:flex;background:var(--s2);border-bottom:1px solid var(--b1)}
    .tab{flex:1;padding:12px 4px;text-align:center;font-size:12px;font-weight:500;
      color:var(--td);cursor:pointer;border-bottom:2px solid transparent;
      transition:all .15s ease;}
    .tab.on{color:var(--ac);border-bottom-color:var(--ac);background:rgba(99,102,241,.05)}
    .tab:hover:not(.on){color:var(--tx)}

    .panel{display:none;padding:20px 24px 90px}
    .panel.on{display:block;}

    .sec{font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;
      color:var(--td);margin:20px 0 10px;display:flex;align-items:center;gap:10px}
    .sec::after{content:'';flex:1;height:1px;background:var(--b1);}
    .sec:first-child{margin-top:0}

    .ig{margin-bottom:12px}
    label{display:block;font-size:11.5px;color:var(--tx);margin-bottom:5px;font-weight:500;}
    label .r{color:#f43f5e;margin-left:2px}
    label .h{color:var(--td);font-size:10.5px;margin-left:6px;font-weight:400}

    input[type=text],input[type=email],input[type=tel],input[type=url],
    input[type=password],textarea,select{
      width:100%;padding:10px 12px;background:var(--s1);border:1px solid var(--b1);
      border-radius:6px;color:var(--tx);font-family:inherit;
      font-size:13px;outline:none;transition:border-color .15s;}
    input:focus,textarea:focus,select:focus{
      border-color:var(--ac);box-shadow:0 0 0 2px rgba(99,102,241,.2)}
    input::placeholder,textarea::placeholder{color:var(--td)}
    textarea{resize:vertical;line-height:1.5}

    .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}

    .stags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .stag{padding:4px 10px;border-radius:12px;font-size:11.5px;font-weight:500;
      background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.3);
      color:var(--ac2);cursor:pointer;transition:all .15s;}
    .stag:hover{background:var(--ac);color:#fff;border-color:var(--ac)}

    .box{padding:12px 16px;border-radius:8px;font-size:12.5px;line-height:1.6;margin-bottom:14px;}
    .box-blue{background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.2);color:var(--tx);}
    .box-yellow{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);color:var(--tx);}
    .box-green{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);color:var(--tx);}
    .box strong{font-weight:600;color:var(--tx)}
    .box a{color:var(--ac);text-decoration:none;}
    .box a:hover{text-decoration:underline;}

    .steps{margin-bottom:12px}
    .step{display:flex;gap:12px;align-items:flex-start;
      padding:10px 0;border-bottom:1px solid var(--b1);
      font-size:12.5px;color:var(--tm);line-height:1.5}
    .step:last-child{border-bottom:none;padding-bottom:0}
    .snum{width:22px;height:22px;border-radius:50%;flex-shrink:0;
      background:var(--s1);border:1px solid var(--ac);
      color:var(--ac);font-size:11px;font-weight:600;
      display:flex;align-items:center;justify-content:center}
    .step a{color:var(--ac);text-decoration:none}
    .step a:hover{text-decoration:underline}
    .step code{background:var(--s1);color:var(--ac2);border:1px solid var(--b1);
      padding:2px 6px;border-radius:4px;font-family:monospace}

    .trow{display:flex;align-items:center;justify-content:space-between;
      padding:10px 0;border-bottom:1px solid var(--b1);margin-bottom:6px}
    .tlbl{font-size:13px;color:var(--tx);font-weight:500}
    .tsub{font-size:11.5px;color:var(--td);margin-top:2px}
    .tog{position:relative;width:36px;height:20px;flex-shrink:0}
    .tog input{opacity:0;width:0;height:0}
    .tsl{position:absolute;inset:0;background:var(--s3);
      border-radius:20px;cursor:pointer;transition:.2s;}
    .tsl::before{content:'';position:absolute;width:16px;height:16px;
      left:2px;top:2px;background:#fff;border-radius:50%;transition:.2s}
    .tog input:checked+.tsl{background:var(--ac);}
    .tog input:checked+.tsl::before{transform:translateX(16px);}

    .btn{padding:10px 16px;border-radius:6px;font-family:inherit;
      font-size:13px;font-weight:600;cursor:pointer;border:none;
      transition:all .15s;}
    .btn-p{background:var(--ac);color:#fff;}
    .btn-p:hover:not(:disabled){background:#4f46e5;}
    .btn-p:disabled{opacity:.5;cursor:not-allowed}
    .btn-s{background:var(--s1);color:var(--tx);border:1px solid var(--b1)}
    .btn-s:hover{border-color:var(--ac);color:var(--ac)}
    .btn-d{background:transparent;color:#f43f5e;border:1px solid rgba(244,63,94,.3)}
    .btn-d:hover{background:rgba(244,63,94,.1)}
    .btn-sm{padding:6px 12px;font-size:12px}
    .brow{display:flex;gap:10px}
    .brow .grow{flex:1}

    .krow{display:flex;gap:8px}
    .krow input{flex:1}

    .sbar{position:fixed;bottom:0;width:480px;padding:14px 24px;
      background:var(--s1);border-top:1px solid var(--b1);
      display:flex;gap:10px;align-items:center;z-index:99;}
    .ss{font-size:12px;color:var(--ac3);flex:1;opacity:0;transition:opacity .3s;font-weight:500;}
    .ss.show{opacity:1}
  </style>"""
    
    updated_content = re.sub(r'<style>.*?</style>', new_css, content, flags=re.DOTALL)
    
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(updated_content)

def resize_icons():
    # Use the specific generated image filename here
    img_path = r"C:\Users\maniv\.gemini\antigravity\brain\91c7b2a8-3b45-4af6-94e2-408b0d7b3a19\professional_app_icon_1774728644858.png"
    out_dir = r"c:\Users\maniv\OneDrive\Desktop\Downloads\ADS LAB\job-bot\formFillNinjatechnique\icons"
    
    if not os.path.exists(img_path):
        print(f"Error: Could not find generated icon at {img_path}")
        return
        
    try:
        with Image.open(img_path) as img:
            sizes = [16, 32, 48, 128]
            for size in sizes:
                resized = img.resize((size, size), Image.Resampling.LANCZOS)
                save_path = os.path.join(out_dir, f"icon{size}.png")
                resized.save(save_path)
        print("Icons successfully resized and placed in output directory.")
    except Exception as e:
        print(f"Failed to process images: {e}")

if __name__ == "__main__":
    update_css()
    resize_icons()
    print("Done")
