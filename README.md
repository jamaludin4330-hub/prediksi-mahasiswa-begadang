# Simulasi Random Forest - Prediksi Mahasiswa Begadang

## Menjalankan (Windows)
```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
Buka http://127.0.0.1:5000

## Deploy
Push ke GitHub, lalu deploy ke Render/Railway/PythonAnywhere. Start command: `gunicorn app:app`.
