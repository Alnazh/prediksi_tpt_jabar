      /* ================================================================
       CONSTANTS & STATE
    ================================================================= */
      const BL = "#435ebe",
        RD = "#dc3545",
        GR = "#28a745",
        AM = "#ffc107",
        CY = "#0dcaf0",
        PU = "#6f42c1";

      const PAGES = {
        dashboard: {
          title: "Dashboard Prediksi TPT",
          sub: "Tingkat Pengangguran Terbuka Kab/Kota Jawa Barat",
          bc: "Dashboard",
        },
        analisis: {
          title: "Analisis Regresi Linear",
          sub: "Evaluasi model dan performa prediksi",
          bc: "Analisis Regresi",
        },
        prediksi: {
          title: "Prediksi TPT",
          sub: "Proyeksi tingkat pengangguran tahun mendatang",
          bc: "Prediksi",
        },
        ranking: {
          title: "Ranking TPT",
          sub: "Peringkat TPT per tahun di seluruh Kab/Kota",
          bc: "Ranking",
        },
        perbandingan: {
          title: "Perbandingan Kota",
          sub: "Bandingkan tren TPT antar kabupaten/kota",
          bc: "Perbandingan",
        },
        data: {
          title: "Data Lengkap",
          sub: "Seluruh data TPT 2019–2025 dari BPS Jawa Barat",
          bc: "Data Lengkap",
        },
        dataset: {
          title: "Kelola Dataset",
          sub: "Unggah file CSV atau masukkan data secara manual",
          bc: "Kelola Dataset",
        },
      };

      let allDataRows = [],
        dataFilterYear = "all",
        dataSortCol = "tahun",
        dataSortDir = "asc";
      let rankingYear = null;
      let chartOverview = null,
        chartProvTrend = null,
        chartLine = null,
        chartScatter = null,
        chartPredLine = null,
        chartCompare = null;
      let predChartInst = null;
      let yearList = [];
      let overviewSortAsc = true;
      let dashboardData = null;
      let overviewAllData = null;
      let overviewSelectedYear = null;

      /* ================================================================
       NAVIGATION
    ================================================================= */
      function goTo(name) {
        document
          .querySelectorAll(".page-section")
          .forEach((s) => s.classList.remove("active"));
        document.getElementById("section-" + name).classList.add("active");
        document
          .querySelectorAll(".sidebar-item[id^=nav-]")
          .forEach((li) => li.classList.remove("active"));
        document.getElementById("nav-" + name)?.classList.add("active");
        const p = PAGES[name];
        document.getElementById("page-title").textContent = p.title;
        document.getElementById("page-sub").textContent = p.sub;
        document.getElementById("bc-active").textContent = p.bc;

        if (name === "data" && !allDataRows.length) loadDataLengkap();
        if (name === "ranking") {
          if (yearList.length && rankingYear) {
            loadRanking(rankingYear);
          } else if (!allDataRows.length) {
            loadDataLengkap().then(() => {
              if (rankingYear) loadRanking(rankingYear);
            });
          } else if (rankingYear) {
            loadRanking(rankingYear);
          }
        }
      }

      /* ================================================================
       DASHBOARD
    ================================================================= */
      document.addEventListener("DOMContentLoaded", () => {
        loadDashboard();
        loadProvTrend();
      });

      async function loadDashboard() {
        const d = await (await fetch("/api/summary")).json();
        dashboardData = d;
        document.getElementById("badge-tahun").textContent = "Tahun " + d.tahun;
        document.getElementById("s-yr").textContent = d.tahun;
        document.getElementById("s-avg").textContent = d.avg + "%";
        document.getElementById("s-max").textContent = d.max_tpt + "%";
        document.getElementById("s-max-kota").textContent = d.max_kota;
        document.getElementById("s-min").textContent = d.min_tpt + "%";
        document.getElementById("s-min-kota").textContent = d.min_kota;

        // Load all years data for overview tabs
        const allData = await (await fetch("/api/data-lengkap")).json();
        overviewAllData = allData;
        const years = allData.tahun_list;
        overviewSelectedYear = d.tahun; // default to latest

        // Build year tabs for overview chart
        const tabsEl = document.getElementById("overviewYearTabs");
        tabsEl.innerHTML = "";
        years.forEach((y) => {
          const active = y === overviewSelectedYear;
          const btn = document.createElement("button");
          btn.className = `btn btn-sm yr-tab ${active ? "btn-primary" : "btn-outline-secondary"}`;
          btn.dataset.yr = y;
          btn.textContent = y;
          btn.onclick = () => setOverviewYear(y);
          tabsEl.appendChild(btn);
        });

        renderOverviewForYear(overviewSelectedYear);
      }

      function renderOverviewForYear(yr) {
        overviewSelectedYear = yr;
        document.getElementById("badge-tahun").textContent = "Tahun " + yr;
        document.querySelectorAll("#overviewYearTabs .btn").forEach((b) => {
          const on = parseInt(b.dataset.yr) === yr;
          b.className = `btn btn-sm yr-tab me-1 ${on ? "btn-primary" : "btn-outline-secondary"}`;
        });
        if (!overviewAllData) return;
        const rows = overviewAllData.rows.filter((r) => r.tahun === yr);
        let labels = rows.map((r) => r.kota);
        let values = rows.map((r) => r.tpt);
        // sort
        const paired = labels.map((l, i) => ({ l, v: values[i] }));
        paired.sort((a, b) => (overviewSortAsc ? a.v - b.v : b.v - a.v));
        labels = paired.map((p) => p.l);
        values = paired.map((p) => p.v);
        const colors = values.map((v) =>
          v >= 9 ? RD : v >= 6 ? AM : v >= 4 ? BL : GR,
        );
        if (chartOverview) chartOverview.destroy();
        chartOverview = new Chart(document.getElementById("chartOverview"), {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                label: "TPT (%)",
                data: values,
                backgroundColor: colors,
                borderRadius: 5,
                borderSkipped: false,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => "  TPT: " + ctx.parsed.y.toFixed(2) + "%",
                },
              },
            },
            scales: {
              y: {
                min: 0,
                ticks: { callback: (v) => v + "%" },
                grid: { color: "#f5f5f5" },
              },
              x: {
                ticks: { font: { size: 9 }, maxRotation: 55, minRotation: 30 },
                grid: { display: false },
              },
            },
          },
        });
      }

      function setOverviewYear(yr) {
        renderOverviewForYear(yr);
      }

      function renderOverviewChart(d, ascending) {
        // legacy — redirect to year-based
        if (overviewSelectedYear) renderOverviewForYear(overviewSelectedYear);
      }

      function setOverviewSort(dir) {
        overviewSortAsc = dir === "asc";
        document.getElementById("btnSortAsc").className =
          `btn ${overviewSortAsc ? "btn-primary" : "btn-outline-secondary"}`;
        document.getElementById("btnSortDesc").className =
          `btn ${!overviewSortAsc ? "btn-primary" : "btn-outline-secondary"}`;
        document.getElementById("overview-sort-label").textContent =
          overviewSortAsc
            ? "Terendah → Tertinggi (kiri ke kanan)"
            : "Tertinggi → Terendah (kiri ke kanan)";
        if (overviewSelectedYear) renderOverviewForYear(overviewSelectedYear);
      }

      async function loadProvTrend() {
        const d = await (await fetch("/api/province-trend")).json();
        if (chartProvTrend) chartProvTrend.destroy();
        chartProvTrend = new Chart(document.getElementById("chartProvTrend"), {
          type: "line",
          data: {
            labels: d.labels,
            datasets: [
              {
                label: "Rata-rata",
                data: d.avg,
                borderColor: BL,
                backgroundColor: BL + "22",
                fill: true,
                tension: 0.35,
                pointRadius: 5,
                borderWidth: 2.5,
              },
              {
                label: "Tertinggi",
                data: d.mx,
                borderColor: RD,
                borderDash: [5, 3],
                tension: 0.35,
                pointRadius: 4,
                borderWidth: 1.5,
                fill: false,
              },
              {
                label: "Terendah",
                data: d.mn,
                borderColor: GR,
                borderDash: [5, 3],
                tension: 0.35,
                pointRadius: 4,
                borderWidth: 1.5,
                fill: false,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { labels: { usePointStyle: true, padding: 16 } },
              tooltip: {
                callbacks: {
                  label: (ctx) =>
                    "  " +
                    ctx.dataset.label +
                    ": " +
                    ctx.parsed.y.toFixed(2) +
                    "%",
                },
              },
            },
            scales: {
              y: {
                ticks: { callback: (v) => v + "%" },
                grid: { color: "#f5f5f5" },
              },
              x: { grid: { display: false } },
            },
          },
        });
      }

      /* ================================================================
       ANALISIS REGRESI
    ================================================================= */
      async function runAnalysis() {
        const kota = document.getElementById("selKotaAnalisis").value;
        if (!kota) {
          alert("Pilih Kabupaten/Kota terlebih dahulu!");
          return;
        }

        document.getElementById("spinAnalisis").classList.add("on");
        document.getElementById("analisis-result").style.display = "none";

        const d = await (
          await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kota }),
          })
        ).json();
        document.getElementById("spinAnalisis").classList.remove("on");
        if (d.error) {
          alert(d.error);
          return;
        }

        const m = d.metrics;
        document.getElementById("lbl-kota-an").textContent = kota;
        document.getElementById("mMAE").textContent = m.mae;
        document.getElementById("mMSE").textContent = m.mse;
        document.getElementById("mR2").textContent = m.r2;
        document.getElementById("mCoef").textContent = m.coef;
        document.getElementById("mIntercept").textContent = m.intercept;

        const o = d.ols;
        document.getElementById("olsFormula").textContent =
          `Persamaan: Y = a + bX\n\nb = (ΣXY − n·X̄·Ȳ) / (ΣX² − n·X̄²)\nb = (${o.sum_xy} − ${o.n}×${o.mean_x}×${o.mean_y}) / (${o.sum_x2} − ${o.n}×${o.mean_x}²)\nb = ${o.b_num} / ${o.b_den}\nb = ${o.b}\n\na = Ȳ − b·X̄\na = ${o.mean_y} − ${o.b}×${o.mean_x}\na = ${o.a}`;

        const ols = document.getElementById("olsSteps");
        ols.innerHTML = `
    <div class="calc-step">n = ${o.n} &nbsp;|&nbsp; ΣX = ${o.sum_x} &nbsp;|&nbsp; ΣY = ${o.sum_y}</div>
    <div class="calc-step">ΣXY = ${o.sum_xy} &nbsp;|&nbsp; ΣX² = ${o.sum_x2}</div>
    <div class="calc-step">X̄ = ${o.mean_x} &nbsp;|&nbsp; Ȳ = ${o.mean_y}</div>
    <div class="calc-step fw-bold" style="border-left:3px solid #435ebe">b = ${o.b} &nbsp;|&nbsp; a = ${o.a}</div>
    <div class="calc-step" style="background:#e6f4ea;color:#1a7f3c">Persamaan akhir: Y = ${o.a} + (${o.b} × Tahun)</div>`;

        if (chartLine) chartLine.destroy();
        chartLine = new Chart(document.getElementById("chartLine"), {
          type: "line",
          data: {
            labels: d.chart.labels,
            datasets: [
              {
                label: "Aktual (%)",
                data: d.chart.actual,
                borderColor: BL,
                backgroundColor: BL + "18",
                pointBackgroundColor: BL,
                pointRadius: 6,
                borderWidth: 2.5,
                fill: true,
                tension: 0,
              },
              {
                label: "Prediksi (%)",
                data: d.chart.predicted,
                borderColor: RD,
                backgroundColor: "transparent",
                pointBackgroundColor: RD,
                pointRadius: 4,
                borderWidth: 2,
                borderDash: [7, 4],
                tension: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { labels: { usePointStyle: true, padding: 16 } },
              tooltip: {
                callbacks: {
                  label: (ctx) =>
                    "  " +
                    ctx.dataset.label +
                    ": " +
                    ctx.parsed.y.toFixed(2) +
                    "%",
                },
              },
            },
            scales: {
              y: {
                ticks: { callback: (v) => v + "%" },
                grid: { color: "#f5f5f5" },
              },
              x: { grid: { display: false } },
            },
          },
        });

        const pts = d.steps.map((s) => ({
          x: s.aktual,
          y: s.prediksi,
          tahun: s.tahun,
        }));
        const vals = pts.flatMap((p) => [p.x, p.y]);
        const minV = Math.min(...vals) - 0.5,
          maxV = Math.max(...vals) + 0.5;
        if (chartScatter) chartScatter.destroy();
        chartScatter = new Chart(document.getElementById("chartScatter"), {
          type: "scatter",
          data: {
            datasets: [
              {
                label: "Aktual vs Prediksi",
                data: pts,
                backgroundColor: BL + "cc",
                borderColor: BL,
                pointRadius: 8,
                pointHoverRadius: 10,
              },
              {
                label: "Ideal (y=x)",
                data: [
                  { x: minV, y: minV },
                  { x: maxV, y: maxV },
                ],
                type: "line",
                borderColor: GR,
                borderWidth: 1.5,
                borderDash: [5, 3],
                pointRadius: 0,
                fill: false,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { labels: { usePointStyle: true, padding: 16 } },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    if (ctx.datasetIndex !== 0) return "";
                    return `  ${ctx.raw.tahun} | Aktual:${ctx.raw.x}% → Pred:${ctx.raw.y}%`;
                  },
                },
              },
            },
            scales: {
              x: {
                title: { display: true, text: "Aktual (%)" },
                ticks: { callback: (v) => v + "%" },
                grid: { color: "#f5f5f5" },
              },
              y: {
                title: { display: true, text: "Prediksi (%)" },
                ticks: { callback: (v) => v + "%" },
                grid: { color: "#f5f5f5" },
              },
            },
          },
        });

        const tbody = document.getElementById("anTableBody");
        tbody.innerHTML = "";
        let sA = 0,
          sP = 0,
          sS = 0;
        d.steps.forEach((r) => {
          sA += r.aktual;
          sP += r.prediksi;
          sS += r.selisih;
          const badge =
            r.selisih < 0.5
              ? '<span class="b-t">Tinggi</span>'
              : r.selisih < 1.5
                ? '<span class="b-s">Sedang</span>'
                : '<span class="b-r">Rendah</span>';
          tbody.innerHTML += `<tr>
      <td class="ps-3 fw-bold text-primary">${r.tahun}</td>
      <td class="text-end">${r.aktual.toFixed(2)}</td>
      <td class="text-end fw-semibold">${r.prediksi.toFixed(2)}</td>
      <td class="text-end">${r.selisih.toFixed(4)}</td>
      <td class="text-center">${badge}</td>
      <td><span style="font-size:11px;font-family:monospace;color:#666">${r.kalkulasi}</span></td>
    </tr>`;
        });
        const n = d.steps.length;
        document.getElementById("an-avgAkt").textContent = (sA / n).toFixed(2);
        document.getElementById("an-avgPred").textContent = (sP / n).toFixed(2);
        document.getElementById("an-avgSel").textContent = (sS / n).toFixed(4);
        document.getElementById("anTableFoot").style.display = "";
        document.getElementById("an-total").textContent = n + " data";
        document.getElementById("analisis-result").style.display = "";
      }

      /* ================================================================
       PREDIKSI TPT
    ================================================================= */
      async function doPrediksi() {
        const kota = document.getElementById("selKotaPred").value;
        const tahun = parseInt(document.getElementById("inpTahunPred").value);
        if (!kota) {
          alert("Pilih Kabupaten/Kota!");
          return;
        }
        if (!tahun || tahun < 2000 || tahun > 2100) {
          alert("Tahun tidak valid.");
          return;
        }

        document.getElementById("spinPred").classList.add("on");
        const d = await fetchPrediksi(kota, tahun);
        document.getElementById("spinPred").classList.remove("on");
        if (!d) return;

        // Switch layout: hide initial centered form, show side-by-side
        document.getElementById("predInitialWrap").style.display = "none";
        document.getElementById("predFullLayout").style.display = "";
        // Pre-fill the side form with same values
        document.getElementById("selKotaPred2").value = kota;
        document.getElementById("inpTahunPred2").value = tahun;

        applyPrediksiResult(d, kota, tahun);
      }

      async function doPrediksiSide() {
        const kota = document.getElementById("selKotaPred2").value;
        const tahun = parseInt(document.getElementById("inpTahunPred2").value);
        if (!kota) {
          alert("Pilih Kabupaten/Kota!");
          return;
        }
        if (!tahun || tahun < 2000 || tahun > 2100) {
          alert("Tahun tidak valid.");
          return;
        }

        document.getElementById("spinPred2").classList.add("on");
        const d = await fetchPrediksi(kota, tahun);
        document.getElementById("spinPred2").classList.remove("on");
        if (!d) return;
        applyPrediksiResult(d, kota, tahun);
      }

      async function fetchPrediksi(kota, tahun) {
        const res = await fetch("/api/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kota, tahun }),
        });
        const d = await res.json();
        if (d.error) {
          alert(d.error);
          return null;
        }
        return d;
      }

      function applyPrediksiResult(d, kota, tahun) {
        document.getElementById("pNum").textContent = d.prediksi.toFixed(2);
        document.getElementById("pTahun").textContent = "Tahun " + tahun;
        document.getElementById("pKota").textContent = kota;

        document.getElementById("predFormula").textContent =
          `Y = a + b × X\nY = ${d.intercept} + (${d.coef} × X)`;
        const steps = document.getElementById("predCalcSteps");
        steps.innerHTML = `
    <div class="calc-step">Y = ${d.intercept} + (${d.coef} × ${tahun})</div>
    <div class="calc-step">Y = ${d.intercept} + (${(d.coef * tahun).toFixed(4)})</div>
    <div class="calc-step fw-bold" style="border-left:3px solid #435ebe;color:#435ebe">Y = ${d.prediksi}</div>`;
        document.getElementById("predTrenText").textContent =
          d.tren === "turun" ? "📉 Menurun" : "📈 Meningkat";
        const deltaStr =
          (d.selisih_dr_terakhir >= 0 ? "+" : "") +
          d.selisih_dr_terakhir.toFixed(2) +
          "%";
        document.getElementById("predDelta").textContent = deltaStr;
        document.getElementById("predCalcCard").style.display = "";

        const labels = [...d.hist_labels, tahun];
        const actual = [...d.hist_actual, null];
        const predicted = [...d.hist_predicted, d.prediksi];
        if (predChartInst) predChartInst.destroy();
        predChartInst = new Chart(document.getElementById("chartPredLine"), {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "Aktual (%)",
                data: actual,
                borderColor: BL,
                backgroundColor: BL + "18",
                pointBackgroundColor: BL,
                pointRadius: 6,
                borderWidth: 2.5,
                fill: true,
                tension: 0,
                spanGaps: false,
              },
              {
                label: "Prediksi/Proyeksi (%)",
                data: predicted,
                borderColor: RD,
                backgroundColor: "transparent",
                pointBackgroundColor: (ctx) =>
                  ctx.dataIndex === labels.length - 1 ? AM : RD,
                pointRadius: (ctx) =>
                  ctx.dataIndex === labels.length - 1 ? 10 : 4,
                borderWidth: 2,
                borderDash: [7, 4],
                tension: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { labels: { usePointStyle: true, padding: 16 } },
              tooltip: {
                callbacks: {
                  label: (ctx) =>
                    "  " +
                    ctx.dataset.label +
                    ": " +
                    (ctx.parsed.y?.toFixed(2) ?? "—") +
                    "%",
                },
              },
            },
            scales: {
              y: {
                ticks: { callback: (v) => v + "%" },
                grid: { color: "#f5f5f5" },
              },
              x: { grid: { display: false } },
            },
          },
        });
        document.getElementById("predChartTitle").textContent = kota;

        const htbody = document.getElementById("predHistTable");
        htbody.innerHTML = "";
        d.hist_labels.forEach((yr, i) => {
          const act = d.hist_actual[i],
            pr = d.hist_predicted[i],
            sel = Math.abs(act - pr).toFixed(2);
          htbody.innerHTML += `<tr>
      <td class="ps-3 fw-bold text-primary">${yr}</td>
      <td class="text-end">${act.toFixed(2)}</td>
      <td class="text-end">${pr.toFixed(2)}</td>
      <td class="text-end">${sel}</td>
      <td><span class="text-muted small">Data historis</span></td>
    </tr>`;
        });
        htbody.innerHTML += `<tr style="background:#fff8e1">
    <td class="ps-3 fw-bold" style="color:#856404">${tahun} ⭐</td>
    <td class="text-end text-muted">—</td>
    <td class="text-end fw-bold" style="color:#856404">${d.prediksi.toFixed(2)}</td>
    <td class="text-end">—</td>
    <td><span class="b-s">Proyeksi</span></td>
  </tr>`;
      }

      /* ================================================================
       RANKING
    ================================================================= */
      async function loadRanking(yr) {
        rankingYear = yr;
        document.querySelectorAll("#rankYearTabs .btn").forEach((b) => {
          const on = parseInt(b.dataset.yr) === yr;
          b.className = `btn btn-sm yr-tab me-1 ${on ? "btn-primary" : "btn-outline-secondary"}`;
        });
        const [hi, lo] = await Promise.all([
          fetch(`/api/ranking?tahun=${yr}&n=10&order=desc`).then((r) =>
            r.json(),
          ),
          fetch(`/api/ranking?tahun=${yr}&n=10&order=asc`).then((r) =>
            r.json(),
          ),
        ]);
        document.getElementById("rk-hi-sub").textContent = "Tahun " + yr;
        document.getElementById("rk-lo-sub").textContent = "Tahun " + yr;
        renderRankRows("rkHiBody", hi.rows, false);
        renderRankRows("rkLoBody", lo.rows, true);
      }

      function renderRankRows(id, rows, isLow) {
        const b = document.getElementById(id);
        b.innerHTML = "";
        const rcls = [
          "rk-1",
          "rk-2",
          "rk-3",
          "rk-n",
          "rk-n",
          "rk-n",
          "rk-n",
          "rk-n",
          "rk-n",
          "rk-n",
        ];
        rows.forEach((r, i) => {
          const col = isLow
            ? r.tpt < 4
              ? "text-success fw-bold"
              : r.tpt < 6
                ? "text-primary"
                : ""
            : r.tpt >= 9
              ? "text-danger fw-bold"
              : r.tpt >= 7
                ? "text-warning"
                : "";
          b.innerHTML += `<tr>
      <td class="ps-3"><div class="rk-badge ${rcls[i]}">${r.rank}</div></td>
      <td>${r.kota}</td>
      <td class="text-end pe-3 ${col}">${r.tpt}%</td>
    </tr>`;
        });
      }

      /* ================================================================
       PERBANDINGAN KOTA
    ================================================================= */
      let chartCmpInst = null;
      const CMP_COLORS = [BL, RD, GR, AM, CY];

      async function doCompare() {
        const k1 = document.getElementById("cmpKota1").value;
        const k2 = document.getElementById("cmpKota2").value;
        const k3 = document.getElementById("cmpKota3").value;
        if (!k1 || !k2) {
          alert("Pilih minimal 2 kota!");
          return;
        }
        const kotas = [k1, k2, ...(k3 ? [k3] : [])];

        const allFetched = await Promise.all(
          kotas.map(async (kota, i) => {
            const d = await (
              await fetch(`/api/compare?kota=${encodeURIComponent(kota)}`)
            ).json();
            return {
              kota,
              labels: d.labels,
              values: d.values,
              color: CMP_COLORS[i],
            };
          }),
        );

        // ── Info stat cards ──
        const infoEl = document.getElementById("cmpInfoCards");
        infoEl.innerHTML = "";
        allFetched.forEach((d) => {
          const min = Math.min(...d.values),
            max = Math.max(...d.values);
          const avg = (
            d.values.reduce((a, b) => a + b, 0) / d.values.length
          ).toFixed(2);
          const lastVal = d.values[d.values.length - 1],
            firstVal = d.values[0];
          const trend =
            lastVal > firstVal
              ? "📈 Naik"
              : lastVal < firstVal
                ? "📉 Turun"
                : "➡️ Stabil";
          const minYr = d.labels[d.values.indexOf(min)],
            maxYr = d.labels[d.values.indexOf(max)];
          infoEl.innerHTML += `
      <div class="col-12 col-md-6 col-lg-4">
        <div class="card" style="border-top:4px solid ${d.color}">
          <div class="card-body">
            <div class="d-flex align-items-center gap-2 mb-3">
              <span style="width:12px;height:12px;border-radius:50%;background:${d.color};flex-shrink:0"></span>
              <strong style="font-size:13px">${d.kota}</strong>
            </div>
            <div class="row g-2">
              <div class="col-6"><div class="cmp-stat">
                <div class="cs-label">Rata-rata</div>
                <div class="cs-val" style="color:${d.color}">${avg}%</div>
                <div class="cs-sub">2019–2025</div>
              </div></div>
              <div class="col-6"><div class="cmp-stat">
                <div class="cs-label">Tren Keseluruhan</div>
                <div class="cs-val" style="font-size:15px;color:${d.color}">${trend}</div>
                <div class="cs-sub">${firstVal}% → ${lastVal}%</div>
              </div></div>
              <div class="col-6"><div class="cmp-stat">
                <div class="cs-label">TPT Tertinggi</div>
                <div class="cs-val text-danger">${max}%</div>
                <div class="cs-sub">Tahun ${maxYr}</div>
              </div></div>
              <div class="col-6"><div class="cmp-stat">
                <div class="cs-label">TPT Terendah</div>
                <div class="cs-val text-success">${min}%</div>
                <div class="cs-sub">Tahun ${minYr}</div>
              </div></div>
            </div>
          </div>
        </div>
      </div>`;
        });

        // ── Chart ──
        const datasets = allFetched.map((d) => ({
          label: d.kota,
          data: d.values,
          borderColor: d.color,
          backgroundColor: d.color + "22",
          pointBackgroundColor: d.color,
          pointRadius: 5,
          borderWidth: 2.5,
          fill: false,
          tension: 0.2,
        }));
        const labels = allFetched[0].labels;
        if (chartCmpInst) chartCmpInst.destroy();
        chartCmpInst = new Chart(document.getElementById("chartCompare"), {
          type: "line",
          data: { labels, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { labels: { usePointStyle: true, padding: 20 } },
              tooltip: {
                callbacks: {
                  label: (ctx) =>
                    "  " +
                    ctx.dataset.label +
                    ": " +
                    ctx.parsed.y.toFixed(2) +
                    "%",
                },
              },
            },
            scales: {
              y: {
                ticks: { callback: (v) => v + "%" },
                grid: { color: "#f5f5f5" },
              },
              x: { grid: { display: false } },
            },
          },
        });

        // ── Comparison table ──
        const thead = document.getElementById("cmpTableHead");
        const tbody = document.getElementById("cmpTableBody");
        thead.innerHTML = `<tr><th class="ps-3">Tahun</th>${kotas.map((k, i) => `<th style="color:${CMP_COLORS[i]}">${k}</th>`).join("")}<th>Selisih</th></tr>`;
        tbody.innerHTML = "";
        labels.forEach((yr, yi) => {
          const vals = allFetched.map((d) => d.values[yi]);
          const minV = Math.min(...vals),
            maxV = Math.max(...vals);
          const spread = (maxV - minV).toFixed(2);
          const cells = vals
            .map((v) => {
              const isBest = v === minV && vals.length > 1,
                isWorst = v === maxV && vals.length > 1;
              const cls = isWorst
                ? "text-danger fw-bold"
                : isBest
                  ? "text-success fw-bold"
                  : "";
              return `<td class="${cls}">${v.toFixed(2)}%</td>`;
            })
            .join("");
          tbody.innerHTML += `<tr><td class="ps-3 fw-semibold text-primary">${yr}</td>${cells}<td class="text-muted small">${spread}%</td></tr>`;
        });

        document.getElementById("cmpResult").style.display = "";
      }

      /* ================================================================
       DATA LENGKAP
    ================================================================= */
      async function loadDataLengkap() {
        const d = await (await fetch("/api/data-lengkap")).json();
        allDataRows = d.rows;
        yearList = d.tahun_list;

        // Set rankingYear to latest
        if (!rankingYear && yearList.length)
          rankingYear = yearList[yearList.length - 1];

        // Year tabs (data)
        const dtEl = document.getElementById("dataYearTabs");
        dtEl.innerHTML = `<button class="btn btn-primary btn-sm yr-tab me-1" onclick="setDataYear('all')" data-yr="all">Semua</button>`;
        yearList.forEach((y) => {
          dtEl.innerHTML += `<button class="btn btn-outline-secondary btn-sm yr-tab me-1" onclick="setDataYear(${y})" data-yr="${y}">${y}</button>`;
        });

        // Year tabs (ranking) — mark latest active
        const rkEl = document.getElementById("rankYearTabs");
        rkEl.innerHTML = "";
        yearList.forEach((y) => {
          const active = y === rankingYear;
          rkEl.innerHTML += `<button class="btn ${active ? "btn-primary" : "btn-outline-secondary"} btn-sm yr-tab me-1" onclick="loadRanking(${y})" data-yr="${y}">${y}</button>`;
        });

        // Download checkboxes
        const dlEl = document.getElementById("dlYearCheckboxes");
        dlEl.innerHTML = "";
        yearList.forEach((y) => {
          dlEl.innerHTML += `<label class="me-2" style="font-size:12px">
    <input type="checkbox" class="dl-yr-cb me-1" value="${y}" checked>${y}</label>`;
        });

        // Sort headers
        document.querySelectorAll("th.sortable").forEach((th) => {
          th.addEventListener("click", () => {
            const col = th.dataset.col;
            if (dataSortCol === col)
              dataSortDir = dataSortDir === "asc" ? "desc" : "asc";
            else {
              dataSortCol = col;
              dataSortDir = "asc";
            }
            document.querySelectorAll("th.sortable").forEach((t) => {
              t.classList.remove("asc", "desc");
            });
            th.classList.add(dataSortDir);
            filterData();
          });
        });

        renderData(allDataRows);
      }

      function setDataYear(yr) {
        dataFilterYear = yr;
        document.querySelectorAll("#dataYearTabs .btn").forEach((b) => {
          const on = b.dataset.yr == yr;
          b.className = `btn btn-sm yr-tab me-1 ${on ? "btn-primary" : "btn-outline-secondary"}`;
        });
        filterData();
      }

      function filterData() {
        const q = document.getElementById("dataSearch").value.toLowerCase();
        let rows =
          dataFilterYear === "all"
            ? allDataRows
            : allDataRows.filter((r) => r.tahun === parseInt(dataFilterYear));
        if (q) rows = rows.filter((r) => r.kota.toLowerCase().includes(q));
        rows = [...rows].sort((a, b) => {
          if (dataSortCol === "kota")
            return dataSortDir === "asc"
              ? a.kota.localeCompare(b.kota)
              : b.kota.localeCompare(a.kota);
          if (dataSortCol === "tpt")
            return dataSortDir === "asc" ? a.tpt - b.tpt : b.tpt - a.tpt;
          if (dataSortCol === "no") return dataSortDir === "asc" ? 0 : 0; // index-based, handled in render
          return dataSortDir === "asc" ? a.tahun - b.tahun : b.tahun - a.tahun;
        });
        renderData(rows);
      }

      function renderData(rows) {
        const b = document.getElementById("dataBody");
        b.innerHTML = "";
        const tpts = rows.map((r) => r.tpt);
        const maxTpt = Math.max(...tpts, 1);
        rows.forEach((r, i) => {
          const isDanger = r.tpt >= 9,
            isGood = r.tpt <= 3;
          const valColor = isDanger
            ? "#dc3545"
            : isGood
              ? "#28a745"
              : "#435ebe";
          const barColor = isDanger
            ? "#dc3545"
            : isGood
              ? "#28a745"
              : r.tpt >= 6
                ? "#ffc107"
                : "#435ebe";
          const barW = Math.max(4, Math.round((r.tpt / maxTpt) * 100));
          const statusBadge = isDanger
            ? '<span class="badge" style="background:#fde8e8;color:#b91c1c;font-size:10px"><i class="bi bi-arrow-up-short"></i>Tinggi</span>'
            : isGood
              ? '<span class="badge" style="background:#e6f4ea;color:#1a7f3c;font-size:10px"><i class="bi bi-arrow-down-short"></i>Rendah</span>'
              : '<span class="badge" style="background:#e8eeff;color:#435ebe;font-size:10px"><i class="bi bi-dash"></i>Normal</span>';
          b.innerHTML += `<tr>
      <td class="ps-3 text-muted">${i + 1}</td>
      <td class="fw-semibold" style="color:#666">${r.tahun}</td>
      <td>${r.kota}</td>
      <td class="text-center fw-bold" style="color:${valColor}">${r.tpt}%</td>
      <td>
        <div class="tpt-bar-wrap">
          <div class="tpt-bar" style="width:${barW}px;background:${barColor}"></div>
          <span style="font-size:10px;color:#aaa">${r.tpt.toFixed(2)}</span>
        </div>
      </td>
      <td class="text-center">${statusBadge}</td>
    </tr>`;
        });
        document.getElementById("dataTotal").textContent =
          rows.length + " data";
      }

      /* ================================================================
       DOWNLOAD
    ================================================================= */
      function doDownload() {
        const selected = [...document.querySelectorAll(".dl-yr-cb:checked")]
          .map((cb) => cb.value)
          .join(",");
        const fmt = document.getElementById("dlFmt").value;
        const url = `/api/download?fmt=${fmt}&tahun=${selected}&sort=tahun&order=asc`;
        window.open(url, "_blank");
      }

      /* ================================================================
         KELOLA DATASET — Upload CSV & Input Manual
      ================================================================= */
      let activeDataset = "default"; // 'default' | 'custom'
      let manualRows = [];
      let previewAllRows = [];
      let csvParsedRows = [];
      let csvHeaders = [];

      // ── Tab switching ───────────────────────────────────────────────
      function switchDatasetTab(tab) {
        ["upload", "manual", "preview"].forEach((t) => {
          document.getElementById("tab-" + t).style.display =
            t === tab ? "" : "none";
          const link = document.getElementById("tab-" + t + "-link");
          link.classList.toggle("active", t === tab);
        });
        if (tab === "preview") loadPreview();
      }

      // ── Toast helper ────────────────────────────────────────────────
      function showDsToast(msg, color) {
        const el = document.getElementById("dsToast");
        document.getElementById("dsToastMsg").textContent = msg;
        el.style.background = color || "#435ebe";
        el.style.display = "flex";
        setTimeout(() => (el.style.display = "none"), 3000);
      }

      // ── Update status badge ─────────────────────────────────────────
      function updateDsStatus(isCustom, label) {
        const icon = document.getElementById("dsStatusIcon");
        const title = document.getElementById("dsStatusTitle");
        const sub = document.getElementById("dsStatusSub");
        if (isCustom) {
          icon.style.background = "#e3f2fd";
          icon.innerHTML =
            '<i class="bi bi-database-fill-check" style="color:#1565c0;font-size:20px"></i>';
          title.textContent = "Dataset Kustom Aktif";
          sub.textContent = label || "—";
        } else {
          icon.style.background = "#e8f5e9";
          icon.innerHTML =
            '<i class="bi bi-database-fill" style="color:#2e7d32;font-size:20px"></i>';
          title.textContent = "Dataset Bawaan Aktif";
          sub.textContent = "TPT Jawa Barat 2019–2025 · BPS";
        }
      }

      // ── Reset ke default ────────────────────────────────────────────
      function resetToDefault() {
        fetch("/api/reset-dataset", { method: "POST" })
          .then((r) => r.json())
          .then(() => {
            activeDataset = "default";
            updateDsStatus(false);
            showDsToast("Dataset direset ke data bawaan", "#388e3c");
            // Reload kota list
            reloadKotaSelects();
          })
          .catch(() => showDsToast("Gagal reset dataset", "#d32f2f"));
      }

      // ── Reload kota selects setelah dataset ganti ───────────────────
      function reloadKotaSelects() {
        fetch("/api/kota-list")
          .then((r) => r.json())
          .then((data) => {
            const kotaList = data.kota_list || [];
            [
              "kotaSelect",
              "predKota",
              "rankingKota",
              "cmpKotaA",
              "cmpKotaB",
            ].forEach((id) => {
              const el = document.getElementById(id);
              if (!el) return;
              const prev = el.value;
              el.innerHTML = '<option value="">— Pilih Kab/Kota —</option>';
              kotaList.forEach((k) => {
                const opt = document.createElement("option");
                opt.value = k;
                opt.textContent = k;
                if (k === prev) opt.selected = true;
                el.appendChild(opt);
              });
            });
            // Update datalist suggestions
            const dl = document.getElementById("kotaSuggestions");
            if (dl) {
              dl.innerHTML = "";
              kotaList.forEach((k) => {
                const opt = document.createElement("option");
                opt.value = k;
                dl.appendChild(opt);
              });
            }
          });
      }

      // ── Drop zone ───────────────────────────────────────────────────
      function handleDrop(e) {
        e.preventDefault();
        document.getElementById("dropZone").classList.remove("dz-active");
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith(".csv")) processFile(file);
        else showDsToast("Hanya file CSV yang didukung", "#d32f2f");
      }
      function handleFileSelect(input) {
        if (input.files.length) processFile(input.files[0]);
      }
      function clearFile() {
        document.getElementById("csvFileInput").value = "";
        document.getElementById("fileInfo").style.display = "none";
        document.getElementById("csvPreviewWrap").style.display = "none";
        document.getElementById("colMappingWrap").style.display = "none";
        document.getElementById("btnUploadCsv").disabled = true;
        csvParsedRows = [];
        csvHeaders = [];
      }

      // ── Parse CSV ───────────────────────────────────────────────────
      function processFile(file) {
        document.getElementById("fileName").textContent = file.name;
        document.getElementById("fileSize").textContent =
          (file.size / 1024).toFixed(1) + " KB · " + "CSV";
        document.getElementById("fileInfo").style.display = "block";

        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result;
          const lines = text.trim().split(/\r?\n/);
          if (lines.length < 2) {
            showDsToast("File CSV kosong atau tidak valid", "#d32f2f");
            return;
          }

          // Detect separator
          const sep = lines[0].includes(";") ? ";" : ",";
          csvHeaders = lines[0]
            .split(sep)
            .map((h) => h.trim().replace(/^"+|"+$/g, ""));
          csvParsedRows = lines
            .slice(1)
            .map((l) =>
              l.split(sep).map((v) => v.trim().replace(/^"+|"+$/g, "")),
            )
            .filter((r) => r.some((v) => v));

          // Preview table
          const tbl = document.getElementById("csvPreviewTable");
          const preview = csvParsedRows.slice(0, 5);
          tbl.innerHTML =
            "<thead><tr>" +
            csvHeaders
              .map(
                (h) =>
                  `<th style="font-size:11px;white-space:nowrap">${h}</th>`,
              )
              .join("") +
            "</tr></thead><tbody>" +
            preview
              .map(
                (r) =>
                  "<tr>" +
                  r
                    .map((v) => `<td style="font-size:11px">${v}</td>`)
                    .join("") +
                  "</tr>",
              )
              .join("") +
            "</tbody>";
          document.getElementById("csvPreviewWrap").style.display = "block";

          // Mapping selects
          function fillSelect(id, preferred) {
            const sel = document.getElementById(id);
            sel.innerHTML = "";
            csvHeaders.forEach((h, i) => {
              const opt = document.createElement("option");
              opt.value = i;
              opt.textContent = h;
              // auto-detect
              if (preferred.some((p) => h.toLowerCase().includes(p)))
                opt.selected = true;
              sel.appendChild(opt);
            });
          }
          fillSelect("mapKota", [
            "kota",
            "kabupaten",
            "wilayah",
            "daerah",
            "region",
          ]);
          fillSelect("mapTahun", ["tahun", "year", "periode"]);
          fillSelect("mapTpt", [
            "tpt",
            "pengangguran",
            "unemployment",
            "nilai",
            "value",
            "persen",
          ]);
          // satuan select — add empty first
          const satSel = document.getElementById("mapSatuan");
          satSel.innerHTML = '<option value="">— tidak ada —</option>';
          csvHeaders.forEach((h, i) => {
            const opt = document.createElement("option");
            opt.value = i;
            opt.textContent = h;
            if (
              h.toLowerCase().includes("satuan") ||
              h.toLowerCase().includes("unit")
            )
              opt.selected = true;
            satSel.appendChild(opt);
          });
          document.getElementById("colMappingWrap").style.display = "block";
          document.getElementById("btnUploadCsv").disabled = false;
        };
        reader.readAsText(file, "utf-8");
      }

      // ── Upload CSV ke server ────────────────────────────────────────
      function uploadCsv() {
        if (!csvParsedRows.length) return;
        const iKota = parseInt(document.getElementById("mapKota").value);
        const iTahun = parseInt(document.getElementById("mapTahun").value);
        const iTpt = parseInt(document.getElementById("mapTpt").value);
        const iSat = document.getElementById("mapSatuan").value;

        // Validate
        const rows = csvParsedRows
          .map((r, idx) => {
            const kota = r[iKota] || "";
            const tahun = parseInt(r[iTahun]);
            const tpt = parseFloat(r[iTpt]);
            if (!kota || isNaN(tahun) || isNaN(tpt)) return null;
            return {
              nama_kabupaten_kota: kota,
              tahun,
              tingkat_pengangguran_terbuka: tpt,
              satuan: iSat !== "" ? r[parseInt(iSat)] || "PERSEN" : "PERSEN",
            };
          })
          .filter(Boolean);

        if (rows.length < 3) {
          showDsToast("Data terlalu sedikit (min. 3 baris valid)", "#d32f2f");
          return;
        }

        fetch("/api/upload-dataset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.status === "ok") {
              activeDataset = "custom";
              updateDsStatus(
                true,
                `${rows.length} baris · ${data.kota_count} kab/kota`,
              );
              showDsToast(
                `Dataset berhasil dimuat (${rows.length} baris)`,
                "#388e3c",
              );
              reloadKotaSelects();
            } else {
              showDsToast("Error: " + (data.error || "Gagal"), "#d32f2f");
            }
          })
          .catch(() => showDsToast("Koneksi gagal", "#d32f2f"));
      }

      // ── Manual Table ────────────────────────────────────────────────
      let manualRowId = 0;

      function addManualRow(kota, tahun, tpt, satuan) {
        manualRowId++;
        const id = manualRowId;
        const tbody = document.getElementById("manualTableBody");
        const tr = document.createElement("tr");
        tr.id = "mr-" + id;
        tr.innerHTML = `
          <td class="text-center text-muted small ps-2" style="vertical-align:middle">${id}</td>
          <td><input type="text" value="${kota || ""}" placeholder="Kota Bandung" list="kotaSuggestions"></td>
          <td><input type="number" value="${tahun || new Date().getFullYear()}" min="2000" max="2099" step="1"></td>
          <td><input type="number" value="${tpt || ""}" min="0" max="100" step="0.01" placeholder="0.00"></td>
          <td><input type="text" value="${satuan || "PERSEN"}" placeholder="PERSEN"></td>
          <td class="text-center" style="vertical-align:middle">
            <button class="btn btn-sm btn-link text-danger p-0" onclick="removeManualRow(${id})">
              <i class="bi bi-trash" style="font-size:14px"></i>
            </button>
          </td>`;
        tbody.appendChild(tr);
        updateManualCount();
        // focus first input
        tr.querySelector("input").focus();
      }

      function removeManualRow(id) {
        const tr = document.getElementById("mr-" + id);
        if (tr) tr.remove();
        updateManualCount();
      }

      function clearManualTable() {
        document.getElementById("manualTableBody").innerHTML = "";
        manualRowId = 0;
        updateManualCount();
      }

      function updateManualCount() {
        const n = document.getElementById("manualTableBody").children.length;
        document.getElementById("manualRowCount").textContent = n + " baris";
      }

      function getManualRows() {
        const rows = [];
        document.querySelectorAll("#manualTableBody tr").forEach((tr) => {
          const inputs = tr.querySelectorAll("input");
          const kota = inputs[0].value.trim();
          const tahun = parseInt(inputs[1].value);
          const tpt = parseFloat(inputs[2].value);
          const satuan = inputs[3].value.trim() || "PERSEN";
          if (kota && !isNaN(tahun) && !isNaN(tpt)) {
            rows.push({
              nama_kabupaten_kota: kota,
              tahun,
              tingkat_pengangguran_terbuka: tpt,
              satuan,
            });
          }
        });
        return rows;
      }

      function quickAddRow() {
        const kota = document.getElementById("qaKota").value.trim();
        const tahun = document.getElementById("qaTahun").value;
        const tpt = document.getElementById("qaTpt").value;
        const satuan =
          document.getElementById("qaSatuan").value.trim() || "PERSEN";
        if (!kota || !tahun || !tpt) {
          showDsToast("Lengkapi semua field wajib!", "#f57c00");
          return;
        }
        addManualRow(kota, tahun, tpt, satuan);
        // Clear quick inputs
        document.getElementById("qaKota").value = "";
        document.getElementById("qaTpt").value = "";
      }

      function parsePaste() {
        const text = document.getElementById("pasteArea").value.trim();
        if (!text) return;
        let added = 0;
        text.split(/\r?\n/).forEach((line) => {
          const parts = line.split(/\t/);
          if (parts.length >= 3) {
            const kota = parts[0].trim();
            const tahun = parseInt(parts[1]);
            const tpt = parseFloat(parts[2].replace(",", "."));
            if (kota && !isNaN(tahun) && !isNaN(tpt)) {
              addManualRow(kota, tahun, tpt, parts[3]?.trim() || "PERSEN");
              added++;
            }
          }
        });
        document.getElementById("pasteArea").value = "";
        if (added)
          showDsToast(`${added} baris berhasil ditambahkan`, "#388e3c");
        else
          showDsToast(
            "Format tidak dikenali (gunakan Tab sebagai separator)",
            "#f57c00",
          );
      }

      function importManualFromCurrent() {
        fetch("/api/data-lengkap")
          .then((r) => r.json())
          .then((data) => {
            clearManualTable();
            (data.rows || []).forEach((r) =>
              addManualRow(r.kota, r.tahun, r.tpt, r.satuan),
            );
            showDsToast(
              `${data.rows.length} baris diimpor dari dataset aktif`,
              "#1565c0",
            );
          });
      }

      function submitManual() {
        const rows = getManualRows();
        if (rows.length < 3) {
          showDsToast("Minimal 3 baris data valid diperlukan", "#f57c00");
          return;
        }
        fetch("/api/upload-dataset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.status === "ok") {
              activeDataset = "custom";
              updateDsStatus(
                true,
                `${rows.length} baris · ${data.kota_count} kab/kota (input manual)`,
              );
              showDsToast(
                `Dataset manual berhasil dimuat (${rows.length} baris)`,
                "#388e3c",
              );
              reloadKotaSelects();
            } else {
              showDsToast("Error: " + (data.error || "Gagal"), "#d32f2f");
            }
          })
          .catch(() => showDsToast("Koneksi gagal", "#d32f2f"));
      }

      // ── Preview Tab ─────────────────────────────────────────────────
      function loadPreview() {
        fetch("/api/data-lengkap")
          .then((r) => r.json())
          .then((data) => {
            previewAllRows = data.rows || [];
            renderPreview(previewAllRows);
          });
      }

      function renderPreview(rows) {
        const tbody = document.getElementById("previewTableBody");
        tbody.innerHTML = rows
          .map(
            (r, i) => `<tr>
          <td class="text-muted small">${i + 1}</td>
          <td class="fw-semibold">${r.kota}</td>
          <td>${r.tahun}</td>
          <td class="text-center fw-bold" style="color:#435ebe">${r.tpt}%</td>
          <td class="text-muted small">${r.satuan || "—"}</td>
        </tr>`,
          )
          .join("");
        document.getElementById("previewCount").textContent =
          rows.length + " data";
        document.getElementById("previewInfo").textContent =
          `${rows.length} baris dari dataset ${activeDataset === "custom" ? "kustom" : "bawaan"}`;
      }

      function filterPreview() {
        const q = document.getElementById("previewSearch").value.toLowerCase();
        renderPreview(
          previewAllRows.filter(
            (r) =>
              r.kota.toLowerCase().includes(q) ||
              String(r.tahun).includes(q) ||
              String(r.tpt).includes(q),
          ),
        );
      }

      // ── Init datalist saat dataset page dibuka ─────────────────────
      document.addEventListener("DOMContentLoaded", () => {
        // populate datalist suggestions for quick-add
        fetch("/api/kota-list")
          .then((r) => r.json())
          .then((data) => {
            const dl = document.getElementById("kotaSuggestions");
            if (dl && data.kota_list) {
              data.kota_list.forEach((k) => {
                const opt = document.createElement("option");
                opt.value = k;
                dl.appendChild(opt);
              });
            }
          });

        // Add initial 3 empty manual rows
        addManualRow();
        addManualRow();
        addManualRow();
      });

      /* ================================================================
         DARK MODE TOGGLE
      ================================================================= */
      function toggleTheme() {
        const isDark = document.body.classList.toggle("dark-mode");
        const icon = document.getElementById("theme-icon");
        if (isDark) {
          icon.className = "bi bi-sun";
          localStorage.setItem("tpt-theme", "dark");
        } else {
          icon.className = "bi bi-moon";
          localStorage.setItem("tpt-theme", "light");
        }
      }

      // Apply saved theme on load
      (function () {
        if (localStorage.getItem("tpt-theme") === "dark") {
          document.body.classList.add("dark-mode");
          const icon = document.getElementById("theme-icon");
          if (icon) icon.className = "bi bi-sun";
        }
      })();
