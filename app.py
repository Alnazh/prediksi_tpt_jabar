from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import io, os, json

app = Flask(__name__)
app.secret_key = 'tpt-jabar-secret-2025'  # untuk session
DATA_PATH = os.path.join(os.path.dirname(__file__), 'data', 'tpt_jabar.csv')

# ── In-memory custom dataset (per-process, shared all sessions) ───────────────
_custom_df: pd.DataFrame | None = None

# ── Helpers ────────────────────────────────────────────────────────────────────

def load_data() -> pd.DataFrame:
    global _custom_df
    if _custom_df is not None:
        return _custom_df.copy()
    return pd.read_csv(DATA_PATH)

def get_kota_list():
    return sorted(load_data()['nama_kabupaten_kota'].unique().tolist())

def train_model(kota_name):
    df   = load_data()
    df_k = df[df['nama_kabupaten_kota'] == kota_name].sort_values('tahun').reset_index(drop=True)
    if len(df_k) < 3:
        return None

    X = df_k[['tahun']]
    y = df_k['tingkat_pengangguran_terbuka']

    model = LinearRegression()
    model.fit(X, y)
    y_pred_all = model.predict(X)

    # LOO cross-validation (robust on small datasets)
    loo_preds = []
    for i in range(len(df_k)):
        idx = [j for j in range(len(df_k)) if j != i]
        m   = LinearRegression().fit(X.iloc[idx], y.iloc[idx])
        loo_preds.append(float(m.predict(X.iloc[[i]])[0]))

    mae = mean_absolute_error(y, loo_preds)
    mse = mean_squared_error(y, loo_preds)
    r2  = r2_score(y, y_pred_all)

    return dict(
        model=model, df=df_k, X=X, y=y,
        y_pred_all=y_pred_all,
        mae=round(float(mae), 4),
        mse=round(float(mse), 4),
        r2=round(float(r2), 4),
        intercept=round(float(model.intercept_), 4),
        coef=round(float(model.coef_[0]), 4),
    )


# ── Pages ──────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html', kota_list=get_kota_list())


# ── API: Dashboard summary ─────────────────────────────────────────────────────

@app.route('/api/summary')
def summary():
    df          = load_data()
    latest_year = int(df['tahun'].max())
    lat         = df[df['tahun'] == latest_year].copy()
    lat_asc     = lat.sort_values('tingkat_pengangguran_terbuka', ascending=True)

    top5  = lat.nlargest(5, 'tingkat_pengangguran_terbuka')
    bot5  = lat.nsmallest(5, 'tingkat_pengangguran_terbuka')

    # Province trend across all years
    prov_trend = (df.groupby('tahun')['tingkat_pengangguran_terbuka']
                    .mean().round(2).reset_index())

    return jsonify(
        labels      = lat_asc['nama_kabupaten_kota'].tolist(),
        values      = lat_asc['tingkat_pengangguran_terbuka'].tolist(),
        tahun       = latest_year,
        total_kota  = int(lat['nama_kabupaten_kota'].nunique()),
        avg         = round(float(lat['tingkat_pengangguran_terbuka'].mean()), 2),
        max_tpt     = round(float(top5.iloc[0]['tingkat_pengangguran_terbuka']), 2),
        max_kota    = top5.iloc[0]['nama_kabupaten_kota'],
        min_tpt     = round(float(bot5.iloc[0]['tingkat_pengangguran_terbuka']), 2),
        min_kota    = bot5.iloc[0]['nama_kabupaten_kota'],
        top5_labels = top5['nama_kabupaten_kota'].tolist(),
        top5_values = top5['tingkat_pengangguran_terbuka'].tolist(),
        bot5_labels = bot5['nama_kabupaten_kota'].tolist(),
        bot5_values = bot5['tingkat_pengangguran_terbuka'].tolist(),
        trend_labels= prov_trend['tahun'].tolist(),
        trend_values= prov_trend['tingkat_pengangguran_terbuka'].tolist(),
    )


# ── API: Analyze ───────────────────────────────────────────────────────────────

@app.route('/api/analyze', methods=['POST'])
def analyze():
    kota   = request.get_json().get('kota', '')
    result = train_model(kota)
    if not result:
        return jsonify(error='Data tidak cukup'), 400

    df      = result['df']
    labels  = df['tahun'].tolist()
    actual  = df['tingkat_pengangguran_terbuka'].tolist()
    pred    = [round(float(v), 2) for v in result['y_pred_all']]

    # Full calculation steps for each year
    steps = []
    for i, (_, row) in enumerate(df.iterrows()):
        yr   = int(row['tahun'])
        act  = round(float(row['tingkat_pengangguran_terbuka']), 2)
        pv   = round(float(result['model'].predict(pd.DataFrame({'tahun':[yr]}))[0]), 4)
        resid= round(act - pv, 4)
        steps.append(dict(
            tahun=yr, aktual=act, prediksi=pv,
            selisih=round(abs(act-pv), 4),
            residual=resid,
            kalkulasi=f"Y = {result['intercept']} + ({result['coef']} × {yr}) = {pv}"
        ))

    # Derivation of a and b using OLS formula shown step by step
    n      = len(df)
    X_vals = df['tahun'].tolist()
    Y_vals = actual
    sum_x  = round(sum(X_vals), 2)
    sum_y  = round(sum(Y_vals), 2)
    sum_xy = round(sum(x*y for x,y in zip(X_vals,Y_vals)), 2)
    sum_x2 = round(sum(x**2 for x in X_vals), 2)
    mean_x = round(sum_x/n, 4)
    mean_y = round(sum_y/n, 4)

    ols = dict(
        n=n, sum_x=sum_x, sum_y=sum_y,
        sum_xy=sum_xy, sum_x2=sum_x2,
        mean_x=mean_x, mean_y=mean_y,
        b_num  = round(sum_xy - n*mean_x*mean_y, 4),
        b_den  = round(sum_x2 - n*mean_x**2, 4),
        b      = result['coef'],
        a      = result['intercept'],
    )

    return jsonify(
        kota    = kota,
        metrics = dict(mae=result['mae'], mse=result['mse'], r2=result['r2'],
                       intercept=result['intercept'], coef=result['coef']),
        chart   = dict(labels=labels, actual=actual, predicted=pred),
        steps   = steps,
        ols     = ols,
    )


# ── API: Predict ───────────────────────────────────────────────────────────────

@app.route('/api/predict', methods=['POST'])
def predict():
    body   = request.get_json()
    kota   = body.get('kota', '')
    tahun  = int(body.get('tahun', 2026))
    result = train_model(kota)
    if not result:
        return jsonify(error='Data tidak cukup'), 400

    pf    = pd.DataFrame({'tahun': [tahun]})
    pred  = round(float(result['model'].predict(pf)[0]), 4)
    last  = float(result['df']['tingkat_pengangguran_terbuka'].iloc[-1])
    delta = round(pred - last, 2)

    # Calculation steps for future prediction
    kalkulasi = (f"Y = {result['intercept']} + ({result['coef']} × {tahun})\n"
                 f"Y = {result['intercept']} + ({round(result['coef']*tahun,4)})\n"
                 f"Y = {pred}")

    return jsonify(
        kota               = kota,
        tahun              = tahun,
        prediksi           = pred,
        tren               = 'turun' if result['coef'] < 0 else 'naik',
        coef               = result['coef'],
        intercept          = result['intercept'],
        last_tahun         = int(result['df']['tahun'].iloc[-1]),
        last_aktual        = round(last, 2),
        selisih_dr_terakhir= delta,
        formula            = f"Y = {result['intercept']} + ({result['coef']} × Tahun)",
        kalkulasi          = kalkulasi,
        # Include historical for chart
        hist_labels        = result['df']['tahun'].tolist(),
        hist_actual        = result['df']['tingkat_pengangguran_terbuka'].tolist(),
        hist_predicted     = [round(float(v),2) for v in result['y_pred_all']],
    )


# ── API: Ranking ───────────────────────────────────────────────────────────────

@app.route('/api/ranking')
def ranking():
    df      = load_data()
    tahun   = int(request.args.get('tahun', df['tahun'].max()))
    n       = int(request.args.get('n', 10))
    order   = request.args.get('order', 'desc')
    df_year = df[df['tahun'] == tahun].sort_values(
        'tingkat_pengangguran_terbuka', ascending=(order=='asc')).head(n)
    return jsonify(
        tahun = tahun, order = order,
        rows  = [dict(rank=i+1, kota=r['nama_kabupaten_kota'],
                      tpt=round(float(r['tingkat_pengangguran_terbuka']),2))
                 for i,(_, r) in enumerate(df_year.iterrows())]
    )


# ── API: Data Lengkap ──────────────────────────────────────────────────────────

@app.route('/api/data-lengkap')
def data_lengkap():
    df         = load_data().sort_values(['tahun','nama_kabupaten_kota'])
    tahun_list = sorted(df['tahun'].unique().tolist())
    rows = [dict(tahun=int(r['tahun']), kota=r['nama_kabupaten_kota'],
                 tpt=round(float(r['tingkat_pengangguran_terbuka']),2),
                 satuan=r['satuan'])
            for _, r in df.iterrows()]
    return jsonify(rows=rows, tahun_list=[int(t) for t in tahun_list])


# ── API: Download ──────────────────────────────────────────────────────────────

@app.route('/api/download')
def download():
    fmt       = request.args.get('fmt', 'csv')           # csv | excel | pdf-like
    years_raw = request.args.get('tahun', '')             # e.g. "2019,2020,2021"
    sort_by   = request.args.get('sort', 'tahun')
    order     = request.args.get('order', 'asc')

    df = load_data()

    # Filter by selected years
    if years_raw:
        selected = [int(y) for y in years_raw.split(',') if y.strip().isdigit()]
        if selected:
            df = df[df['tahun'].isin(selected)]

    # Sort
    asc = (order == 'asc')
    if sort_by == 'tpt':
        df = df.sort_values('tingkat_pengangguran_terbuka', ascending=asc)
    elif sort_by == 'kota':
        df = df.sort_values('nama_kabupaten_kota', ascending=asc)
    else:
        df = df.sort_values(['tahun','nama_kabupaten_kota'], ascending=asc)

    export = df[['tahun','nama_kabupaten_kota','tingkat_pengangguran_terbuka','satuan']].copy()
    export.columns = ['Tahun','Kabupaten/Kota','TPT (%)','Satuan']

    if fmt == 'excel':
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine='openpyxl') as writer:
            export.to_excel(writer, index=False, sheet_name='TPT Jabar')
        buf.seek(0)
        return send_file(buf, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                         as_attachment=True, download_name='tpt_jabar.xlsx')

    elif fmt == 'json':
        buf = io.BytesIO(export.to_json(orient='records', indent=2).encode())
        return send_file(buf, mimetype='application/json',
                         as_attachment=True, download_name='tpt_jabar.json')

    else:  # CSV default
        buf = io.BytesIO(export.to_csv(index=False).encode('utf-8-sig'))
        return send_file(buf, mimetype='text/csv',
                         as_attachment=True, download_name='tpt_jabar.csv')


# ── API: Compare kota across years ────────────────────────────────────────────

@app.route('/api/compare')
def compare():
    """Return all years data for a specific kota (for comparison chart)."""
    kota = request.args.get('kota', '')
    df   = load_data()
    df_k = df[df['nama_kabupaten_kota'] == kota].sort_values('tahun')
    return jsonify(
        kota   = kota,
        labels = df_k['tahun'].tolist(),
        values = df_k['tingkat_pengangguran_terbuka'].tolist(),
    )


# ── API: Province overview trend ───────────────────────────────────────────────

@app.route('/api/province-trend')
def province_trend():
    df   = load_data()
    prov = df.groupby('tahun')['tingkat_pengangguran_terbuka'].agg(['mean','max','min']).round(2).reset_index()
    return jsonify(
        labels = prov['tahun'].tolist(),
        avg    = prov['mean'].tolist(),
        mx     = prov['max'].tolist(),
        mn     = prov['min'].tolist(),
    )



# ── API: Kota list (untuk dropdown dynamic) ────────────────────────────────────
@app.route('/api/kota-list')
def kota_list():
    return jsonify(kota_list=get_kota_list())


# ── API: Upload / replace dataset ─────────────────────────────────────────────
@app.route('/api/upload-dataset', methods=['POST'])
def upload_dataset():
    global _custom_df
    body = request.get_json()
    rows = body.get('rows', [])
    if not rows:
        return jsonify(error='Tidak ada data'), 400

    try:
        df = pd.DataFrame(rows)
        # Normalise required columns
        required = ['nama_kabupaten_kota', 'tahun', 'tingkat_pengangguran_terbuka']
        for col in required:
            if col not in df.columns:
                return jsonify(error=f"Kolom '{col}' tidak ditemukan"), 400
        df['tahun'] = df['tahun'].astype(int)
        df['tingkat_pengangguran_terbuka'] = df['tingkat_pengangguran_terbuka'].astype(float)
        if 'satuan' not in df.columns:
            df['satuan'] = 'PERSEN'
        # Add dummy province columns if missing (for compatibility)
        if 'kode_provinsi' not in df.columns:
            df['kode_provinsi'] = 0
        if 'nama_provinsi' not in df.columns:
            df['nama_provinsi'] = 'KUSTOM'
        if 'kode_kabupaten_kota' not in df.columns:
            df['kode_kabupaten_kota'] = 0

        _custom_df = df
        return jsonify(
            status='ok',
            row_count=len(df),
            kota_count=int(df['nama_kabupaten_kota'].nunique())
        )
    except Exception as e:
        return jsonify(error=str(e)), 500


# ── API: Reset ke dataset bawaan ───────────────────────────────────────────────
@app.route('/api/reset-dataset', methods=['POST'])
def reset_dataset():
    global _custom_df
    _custom_df = None
    return jsonify(status='ok', message='Dataset direset ke bawaan')


if __name__ == '__main__':
    app.run(debug=True)
