const STORAGE_KEY = 'saas_metrics_history';

// Industry benchmarks
const BENCHMARKS = {
    mrr: { min: 10000, max: 500000, label: 'SMB to Mid-Market' },
    arr: { min: 120000, max: 6000000, label: 'SMB to Mid-Market' },
    churn: { good: 3, avg: 5, bad: 8, label: 'Monthly churn %' },
    ltvCac: { good: 3, avg: 2, bad: 1, label: 'LTV/CAC ratio' },
    payback: { good: 12, avg: 18, bad: 24, label: 'Months' },
    rule40: { good: 40, avg: 25, bad: 15, label: 'Score' },
    ltv: { min: 1000, max: 10000, label: 'Per customer' }
};

let charts = {};

// Tab Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// Calculator
function getInputs() {
    return {
        mrr: parseFloat(document.getElementById('mrr').value) || 0,
        activeUsers: parseInt(document.getElementById('activeUsers').value) || 0,
        churnRate: parseFloat(document.getElementById('churnRate').value) || 0,
        cac: parseFloat(document.getElementById('cac').value) || 0,
        ltv: parseFloat(document.getElementById('ltv').value) || 0,
        arpu: parseFloat(document.getElementById('arpu').value) || 0,
        growthRate: parseFloat(document.getElementById('growthRate').value) || 0
    };
}

function calculateMetrics(inputs) {
    const { mrr, activeUsers, churnRate, cac, ltv, arpu, growthRate } = inputs;

    const arr = mrr * 12;
    const monthlyChurn = churnRate;
    const avgLifetime = churnRate > 0 ? 100 / churnRate : 0;
    const calcLtv = arpu * avgLifetime;
    const ltvCacRatio = cac > 0 ? calcLtv / cac : 0;
    const paybackMonths = arpu > 0 ? cac / arpu : 0;
    const profitMargin = mrr > 0 ? ((mrr - cac * (activeUsers * churnRate / 100)) / mrr) * 100 : 0;
    const rule40Score = growthRate + Math.min(profitMargin, 100);

    return {
        arr,
        monthlyChurn,
        avgLifetime,
        calcLtv,
        ltvCacRatio,
        paybackMonths,
        rule40Score,
        growthRate
    };
}

function formatCurrency(value) {
    if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return '$' + (value / 1000).toFixed(1) + 'K';
    return '$' + value.toFixed(0);
}

function formatNumber(value) {
    return value.toFixed(1);
}

function getBenchmarkClass(metric, value) {
    const b = BENCHMARKS[metric];
    if (!b) return '';
    if (metric === 'churn') {
        if (value <= b.good) return 'positive';
        if (value <= b.avg) return 'neutral';
        return 'negative';
    }
    if (metric === 'ltvCac') {
        if (value >= b.good) return 'positive';
        if (value >= b.avg) return 'neutral';
        return 'negative';
    }
    if (metric === 'payback') {
        if (value <= b.good) return 'positive';
        if (value <= b.avg) return 'neutral';
        return 'negative';
    }
    if (metric === 'rule40') {
        if (value >= b.good) return 'positive';
        if (value >= b.avg) return 'neutral';
        return 'negative';
    }
    return '';
}

function updateResults(metrics) {
    document.getElementById('arr').textContent = formatCurrency(metrics.arr);
    document.getElementById('churnValue').textContent = formatNumber(metrics.monthlyChurn) + '%';
    document.getElementById('ltvCac').textContent = formatNumber(metrics.ltvCacRatio) + 'x';
    document.getElementById('payback').textContent = formatNumber(metrics.paybackMonths) + ' mo';
    document.getElementById('rule40').textContent = formatNumber(metrics.rule40Score);
    document.getElementById('ltvCalc').textContent = formatCurrency(metrics.calcLtv);

    // Benchmarks
    setBenchmark('arrBenchmark', metrics.arr >= BENCHMARKS.arr.min ? '✓ Within range' : 'Below market average', metrics.arr >= BENCHMARKS.arr.min ? 'positive' : 'negative');
    setBenchmark('churnBenchmark', metrics.monthlyChurn <= BENCHMARKS.churn.good ? '✓ Good' : metrics.monthlyChurn <= BENCHMARKS.churn.avg ? '~ Average' : '⚠ High', getBenchmarkClass('churn', metrics.monthlyChurn));
    setBenchmark('ltvCacBenchmark', metrics.ltvCacRatio >= BENCHMARKS.ltvCac.good ? '✓ Healthy' : metrics.ltvCacRatio >= BENCHMARKS.ltvCac.avg ? '~ Needs work' : '⚠ Unhealthy', getBenchmarkClass('ltvCac', metrics.ltvCacRatio));
    setBenchmark('paybackBenchmark', metrics.paybackMonths <= BENCHMARKS.payback.good ? '✓ Fast' : metrics.paybackMonths <= BENCHMARKS.payback.avg ? '~ Average' : '⚠ Slow', getBenchmarkClass('payback', metrics.paybackMonths));
    setBenchmark('rule40Benchmark', metrics.rule40Score >= BENCHMARKS.rule40.good ? '✓ Elite' : metrics.rule40Score >= BENCHMARKS.rule40.avg ? '~ Good' : '⚠ Below', getBenchmarkClass('rule40', metrics.rule40Score));
    setBenchmark('ltvBenchmark', 'Industry: $1K-$10K', '');

    updateCharts(metrics);
}

function setBenchmark(id, text, className) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = 'metric-benchmark ' + className;
}

function updateCharts(metrics) {
    const inputs = getInputs();
    updateRevenueChart(inputs, metrics);
    updateBreakdownChart(metrics);
    updateProjectionChart(inputs);
    updateLtvCacChart(inputs, metrics);
    updateChurnChart(inputs, metrics);
}

function updateRevenueChart(inputs, metrics) {
    const ctx = document.getElementById('revenueChart');
    if (charts.revenue) charts.revenue.destroy();

    const months = ['Now', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6'];
    const mrrData = [inputs.mrr];
    const arrData = [metrics.arr];

    for (let i = 1; i < 6; i++) {
        const newMrr = mrrData[i - 1] * (1 + inputs.growthRate / 100) * (1 - inputs.churnRate / 100);
        mrrData.push(newMrr);
        arrData.push(newMrr * 12);
    }

    charts.revenue = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'MRR',
                    data: mrrData,
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'ARR',
                    data: arrData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: chartOptions('Revenue ($)')
    });
}

function updateBreakdownChart(metrics) {
    const ctx = document.getElementById('breakdownChart');
    if (charts.breakdown) charts.breakdown.destroy();

    charts.breakdown = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['MRR', 'Churn Impact', 'Growth Added'],
            datasets: [{
                data: [metrics.calcLtv, metrics.monthlyChurn * 10, metrics.growthRate * 5],
                backgroundColor: ['#7c3aed', '#ef4444', '#22c55e'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9090a8', font: { family: 'Inter' } } }
            }
        }
    });
}

function updateProjectionChart(inputs) {
    const ctx = document.getElementById('projectionChart');
    if (charts.projection) charts.projection.destroy();

    const months = [];
    const data = [];
    let mrr = inputs.mrr;

    for (let i = 0; i < 12; i++) {
        months.push('M' + (i + 1));
        data.push(mrr);
        mrr = mrr * (1 + inputs.growthRate / 100) * (1 - inputs.churnRate / 100);
    }

    charts.projection = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Projected MRR',
                data: data,
                backgroundColor: 'rgba(124, 58, 237, 0.6)',
                borderColor: '#7c3aed',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: chartOptions('MRR ($)')
    });
}

function updateLtvCacChart(inputs, metrics) {
    const ctx = document.getElementById('ltvCacChart');
    if (charts.ltvCac) charts.ltvCac.destroy();

    charts.ltvCac = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['LTV', 'CAC', 'Ratio'],
            datasets: [{
                data: [metrics.calcLtv, inputs.cac, metrics.ltvCacRatio * inputs.cac],
                backgroundColor: ['#22c55e', '#ef4444', '#7c3aed'],
                borderRadius: 4
            }]
        },
        options: {
            ...chartOptions('Value ($)'),
            plugins: { legend: { display: false } }
        }
    });
}

function updateChurnChart(inputs, metrics) {
    const ctx = document.getElementById('churnChart');
    if (charts.churn) charts.churn.destroy();

    const months = [];
    const retained = [];
    const lost = [];
    let users = inputs.activeUsers;

    for (let i = 0; i < 12; i++) {
        months.push('M' + (i + 1));
        const churned = users * (inputs.churnRate / 100);
        retained.push(users - churned);
        lost.push(churned);
        users = users - churned;
    }

    charts.churn = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Retained',
                    data: retained,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Lost',
                    data: lost,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: chartOptions('Users')
    });
}

function chartOptions(yLabel) {
    return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { labels: { color: '#9090a8', font: { family: 'Inter' } } }
        },
        scales: {
            x: { ticks: { color: '#606078' }, grid: { color: 'rgba(45, 45, 61, 0.5)' } },
            y: { ticks: { color: '#606078' }, grid: { color: 'rgba(45, 45, 61, 0.5)' }, title: { display: true, text: yLabel, color: '#9090a8' } }
        }
    };
}

// Save / History
function saveSnapshot() {
    const inputs = getInputs();
    const metrics = calculateMetrics(inputs);
    const snapshot = {
        id: Date.now(),
        date: new Date().toISOString(),
        inputs,
        metrics
    };

    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    history.unshift(snapshot);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
    loadHistory();
    alert('Snapshot saved!');
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const list = document.getElementById('historyList');

    if (history.length === 0) {
        list.innerHTML = '<p class="placeholder-text">No saved calculations yet. Save a snapshot from the Calculator tab.</p>';
        return;
    }

    list.innerHTML = history.map(item => `
        <div class="history-item">
            <div>
                <div class="history-date">${new Date(item.date).toLocaleString()}</div>
                <div class="history-metrics">
                    <div class="history-metric">
                        <div class="history-metric-label">MRR</div>
                        <div class="history-metric-value">${formatCurrency(item.inputs.mrr)}</div>
                    </div>
                    <div class="history-metric">
                        <div class="history-metric-label">ARR</div>
                        <div class="history-metric-value">${formatCurrency(item.metrics.arr)}</div>
                    </div>
                    <div class="history-metric">
                        <div class="history-metric-label">Churn</div>
                        <div class="history-metric-value">${formatNumber(item.metrics.monthlyChurn)}%</div>
                    </div>
                    <div class="history-metric">
                        <div class="history-metric-label">LTV/CAC</div>
                        <div class="history-metric-value">${formatNumber(item.metrics.ltvCacRatio)}x</div>
                    </div>
                    <div class="history-metric">
                        <div class="history-metric-label">Rule of 40</div>
                        <div class="history-metric-value">${formatNumber(item.metrics.rule40Score)}</div>
                    </div>
                </div>
            </div>
            <div class="history-actions">
                <button class="btn btn-secondary btn-sm" onclick="loadSnapshot(${item.id})">Load</button>
                <button class="btn btn-danger btn-sm" onclick="deleteSnapshot(${item.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function loadSnapshot(id) {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const snapshot = history.find(h => h.id === id);
    if (!snapshot) return;

    document.getElementById('mrr').value = snapshot.inputs.mrr || '';
    document.getElementById('activeUsers').value = snapshot.inputs.activeUsers || '';
    document.getElementById('churnRate').value = snapshot.inputs.churnRate || '';
    document.getElementById('cac').value = snapshot.inputs.cac || '';
    document.getElementById('ltv').value = snapshot.inputs.ltv || '';
    document.getElementById('arpu').value = snapshot.inputs.arpu || '';
    document.getElementById('growthRate').value = snapshot.inputs.growthRate || '';

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="calculator"]').classList.add('active');
    document.getElementById('calculator').classList.add('active');

    calculate();
}

function deleteSnapshot(id) {
    let history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    history = history.filter(h => h.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    loadHistory();
}

// Export PDF
function exportPDF() {
    const inputs = getInputs();
    const metrics = calculateMetrics(inputs);

    const element = document.createElement('div');
    element.style.padding = '40px';
    element.style.background = '#fff';
    element.style.color = '#000';
    element.style.fontFamily = 'Inter, sans-serif';
    element.style.width = '800px';

    element.innerHTML = `
        <h1 style="color:#7c3aed;margin-bottom:8px">SaaS Metrics Report</h1>
        <p style="color:#666;margin-bottom:32px">${new Date().toLocaleDateString()}</p>
        <h2 style="margin-bottom:16px">Input Metrics</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:32px">
            <tr><td style="padding:8px;border-bottom:1px solid #eee">MRR</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">${formatCurrency(inputs.mrr)}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee">Active Users</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">${inputs.activeUsers.toLocaleString()}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee">Churn Rate</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">${inputs.churnRate}%</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee">CAC</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">${formatCurrency(inputs.cac)}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee">LTV</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">${formatCurrency(inputs.ltv)}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee">ARPU</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">${formatCurrency(inputs.arpu)}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee">Growth Rate</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">${inputs.growthRate}%</td></tr>
        </table>
        <h2 style="margin-bottom:16px">Calculated Metrics</h2>
        <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;border-bottom:1px solid #eee">ARR</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">${formatCurrency(metrics.arr)}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee">Monthly Churn</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">${formatNumber(metrics.monthlyChurn)}%</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee">LTV/CAC Ratio</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">${formatNumber(metrics.ltvCacRatio)}x</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee">Payback Period</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">${formatNumber(metrics.paybackMonths)} months</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee">Rule of 40</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">${formatNumber(metrics.rule40Score)}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee">Calculated LTV</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">${formatCurrency(metrics.calcLtv)}</td></tr>
        </table>
    `;

    html2pdf().set({ margin: 0.5, filename: 'saas-metrics-report.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } }).from(element).save();
}

// What-If Scenarios
function runScenario() {
    const inputs = getInputs();
    const baseMetrics = calculateMetrics(inputs);

    const growthChange = parseFloat(document.getElementById('scenarioGrowth').value) || 0;
    const churnChange = parseFloat(document.getElementById('scenarioChurn').value) || 0;
    const arpuChange = parseFloat(document.getElementById('scenarioARPU').value) || 0;

    const scenarioInputs = {
        ...inputs,
        growthRate: inputs.growthRate * (1 + growthChange / 100),
        churnRate: inputs.churnRate * (1 + churnChange / 100),
        arpu: inputs.arpu * (1 + arpuChange / 100)
    };

    const scenarioMetrics = calculateMetrics(scenarioInputs);

    const results = document.getElementById('scenarioResults');
    results.innerHTML = `
        <div class="scenario-metric">
            <span class="scenario-metric-label">MRR (6 months)</span>
            <div class="scenario-metric-values">
                <span class="scenario-old">${formatCurrency(baseMetrics.arr / 12)}</span>
                <span class="scenario-new">${formatCurrency(scenarioMetrics.arr / 12)}</span>
                <span class="scenario-change ${scenarioMetrics.arr > baseMetrics.arr ? 'positive' : 'negative'}">
                    ${scenarioMetrics.arr > baseMetrics.arr ? '↑' : '↓'} ${Math.abs(((scenarioMetrics.arr - baseMetrics.arr) / baseMetrics.arr * 100)).toFixed(1)}%
                </span>
            </div>
        </div>
        <div class="scenario-metric">
            <span class="scenario-metric-label">ARR</span>
            <div class="scenario-metric-values">
                <span class="scenario-old">${formatCurrency(baseMetrics.arr)}</span>
                <span class="scenario-new">${formatCurrency(scenarioMetrics.arr)}</span>
                <span class="scenario-change ${scenarioMetrics.arr > baseMetrics.arr ? 'positive' : 'negative'}">
                    ${scenarioMetrics.arr > baseMetrics.arr ? '↑' : '↓'} ${Math.abs(((scenarioMetrics.arr - baseMetrics.arr) / baseMetrics.arr * 100)).toFixed(1)}%
                </span>
            </div>
        </div>
        <div class="scenario-metric">
            <span class="scenario-metric-label">Churn Rate</span>
            <div class="scenario-metric-values">
                <span class="scenario-old">${formatNumber(baseMetrics.monthlyChurn)}%</span>
                <span class="scenario-new">${formatNumber(scenarioMetrics.monthlyChurn)}%</span>
                <span class="scenario-change ${scenarioMetrics.monthlyChurn < baseMetrics.monthlyChurn ? 'positive' : 'negative'}">
                    ${scenarioMetrics.monthlyChurn < baseMetrics.monthlyChurn ? '↓' : '↑'} ${Math.abs(scenarioMetrics.monthlyChurn - baseMetrics.monthlyChurn).toFixed(2)}%
                </span>
            </div>
        </div>
        <div class="scenario-metric">
            <span class="scenario-metric-label">LTV/CAC Ratio</span>
            <div class="scenario-metric-values">
                <span class="scenario-old">${formatNumber(baseMetrics.ltvCacRatio)}x</span>
                <span class="scenario-new">${formatNumber(scenarioMetrics.ltvCacRatio)}x</span>
                <span class="scenario-change ${scenarioMetrics.ltvCacRatio > baseMetrics.ltvCacRatio ? 'positive' : 'negative'}">
                    ${scenarioMetrics.ltvCacRatio > baseMetrics.ltvCacRatio ? '↑' : '↓'} ${Math.abs(((scenarioMetrics.ltvCacRatio - baseMetrics.ltvCacRatio) / baseMetrics.ltvCacRatio * 100)).toFixed(1)}%
                </span>
            </div>
        </div>
        <div class="scenario-metric">
            <span class="scenario-metric-label">Rule of 40</span>
            <div class="scenario-metric-values">
                <span class="scenario-old">${formatNumber(baseMetrics.rule40Score)}</span>
                <span class="scenario-new">${formatNumber(scenarioMetrics.rule40Score)}</span>
                <span class="scenario-change ${scenarioMetrics.rule40Score > baseMetrics.rule40Score ? 'positive' : 'negative'}">
                    ${scenarioMetrics.rule40Score > baseMetrics.rule40Score ? '↑' : '↓'} ${Math.abs(scenarioMetrics.rule40Score - baseMetrics.rule40Score).toFixed(1)}
                </span>
            </div>
        </div>
    `;

    updateScenarioChart(inputs, scenarioInputs);
}

function updateScenarioChart(baseInputs, scenarioInputs) {
    const ctx = document.getElementById('scenarioChart');
    if (charts.scenario) charts.scenario.destroy();

    const months = [];
    const baseData = [];
    const scenarioData = [];
    let baseMrr = baseInputs.mrr;
    let scenarioMrr = scenarioInputs.mrr;

    for (let i = 0; i < 12; i++) {
        months.push('M' + (i + 1));
        baseData.push(baseMrr);
        scenarioData.push(scenarioMrr);
        baseMrr = baseMrr * (1 + baseInputs.growthRate / 100) * (1 - baseInputs.churnRate / 100);
        scenarioMrr = scenarioMrr * (1 + scenarioInputs.growthRate / 100) * (1 - scenarioInputs.churnRate / 100);
    }

    charts.scenario = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Base Scenario',
                    data: baseData,
                    borderColor: '#606078',
                    borderDash: [5, 5],
                    tension: 0.4
                },
                {
                    label: 'What-If Scenario',
                    data: scenarioData,
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: chartOptions('MRR ($)')
    });
}

// Cohort Analysis
function generateCohorts() {
    const count = parseInt(document.getElementById('cohortCount').value) || 6;
    const users = parseInt(document.getElementById('cohortUsers').value) || 100;
    const inputs = getInputs();
    const churnRate = inputs.churnRate || 5;

    const thead = document.querySelector('#cohortTable thead');
    const tbody = document.querySelector('#cohortTable tbody');

    let headerHtml = '<tr><th>Cohort</th>';
    for (let m = 0; m < 6; m++) {
        headerHtml += `<th>Month ${m}</th>`;
    }
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    let bodyHtml = '';
    const cohortData = [];

    for (let c = 0; c < count; c++) {
        const month = new Date();
        month.setMonth(month.getMonth() - c);
        const label = month.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

        let retained = users;
        const row = [label];
        const rowData = [];

        for (let m = 0; m < 6; m++) {
            const pct = (retained / users) * 100;
            row.push(pct);
            rowData.push(pct);
            retained = retained * (1 - churnRate / 100);
        }

        cohortData.push(rowData);
        bodyHtml += '<tr>' + row.map((val, i) => {
            if (i === 0) return `<td style="text-align:left;font-weight:600">${val}</td>`;
            const color = getHeatColor(val);
            return `<td><span class="cohort-cell" style="background:${color}">${val.toFixed(0)}%</span></td>`;
        }).join('') + '</tr>';
    }

    tbody.innerHTML = bodyHtml;
    updateCohortChart(cohortData, count);
}

function getHeatColor(pct) {
    if (pct >= 80) return 'rgba(34, 197, 94, 0.3)';
    if (pct >= 60) return 'rgba(34, 197, 94, 0.2)';
    if (pct >= 40) return 'rgba(245, 158, 11, 0.2)';
    if (pct >= 20) return 'rgba(239, 68, 68, 0.2)';
    return 'rgba(239, 68, 68, 0.3)';
}

function updateCohortChart(data, count) {
    const ctx = document.getElementById('cohortChart');
    if (charts.cohort) charts.cohort.destroy();

    const colors = ['#7c3aed', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6'];
    const datasets = data.map((row, i) => ({
        label: `Cohort ${i + 1}`,
        data: row,
        borderColor: colors[i % colors.length],
        tension: 0.4,
        fill: false
    }));

    charts.cohort = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Month 0', 'Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5'],
            datasets
        },
        options: {
            ...chartOptions('Retention %'),
            scales: {
                ...chartOptions('Retention %').scales,
                y: { ...chartOptions('Retention %').scales.y, min: 0, max: 100 }
            }
        }
    });
}

// Event Listeners
document.getElementById('calculateBtn').addEventListener('click', calculate);
document.getElementById('saveBtn').addEventListener('click', saveSnapshot);
document.getElementById('exportPdf').addEventListener('click', exportPDF);
document.getElementById('clearHistory').addEventListener('click', () => {
    if (confirm('Clear all saved calculations?')) {
        localStorage.removeItem(STORAGE_KEY);
        loadHistory();
    }
});
document.getElementById('runScenario').addEventListener('click', runScenario);
document.getElementById('generateCohorts').addEventListener('click', generateCohorts);

// Slider updates
['scenarioGrowth', 'scenarioChurn', 'scenarioARPU'].forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => {
        document.getElementById(id + 'Val').textContent = e.target.value + '%';
    });
});

function calculate() {
    const inputs = getInputs();
    const metrics = calculateMetrics(inputs);
    updateResults(metrics);
}

// Init
loadHistory();
generateCohorts();