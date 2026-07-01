(() => {
  'use strict';

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  const GOALS = [
    {
      name: 'Muscle Gain',
      desc: 'Build higher-calorie weekly plans with stronger protein support for performance recovery.',
      icon: '↑'
    },
    {
      name: 'Weight Loss',
      desc: 'Create lighter meal schedules that stay controlled while keeping protein targets visible.',
      icon: '↓'
    },
    {
      name: 'Weight Maintenance',
      desc: 'Balance calories and macros for a stable lifestyle-oriented weekly rhythm.',
      icon: '↔'
    },
    {
      name: 'Endurance Training',
      desc: 'Prioritize carb energy and complete weekly fuel for high-output training days.',
      icon: '⟳'
    },
    {
      name: 'Balanced Healthy Eating',
      desc: 'Follow the default MealMint baseline for clean, approachable everyday nutrition.',
      icon: '✓'
    },
    {
      name: 'Vegetarian or Vegan',
      desc: 'Focus the experience on plant-forward recipes and suitable dietary tags.',
      icon: '◇'
    },
    {
      name: 'High-Protein Low-Carb',
      desc: 'Support higher protein intake while controlling carb exposure across the week.',
      icon: '◆'
    }
  ];

  const DEFAULT_GOAL = 'Balanced Healthy Eating';
  const GOAL_KEY = 'mealmint.selectedGoal';
  const PLAN_KEY = 'mealmint.weeklyPlan';
  const CHECKED_KEY = 'mealmint.groceryChecked';
  const HIDDEN_KEY = 'mealmint.groceryHidden';

  const state = {
    meals: [],
    mealsById: new Map(),
    mealsByName: new Map(),
    profiles: [],
    profilesByGoal: new Map(),
    samplePlan: [],
    grocery: []
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    updateNavShell();
    try {
      await loadData();
      hydratePlanIfNeeded();
      updateNavMetrics();
      const page = document.body.dataset.page;
      if (page === 'index') initLanding();
      if (page === 'goals') initGoals();
      if (page === 'library') initLibrary();
      if (page === 'planner') initPlanner();
      if (page === 'dashboard') initDashboard();
      if (page === 'grocery') initGrocery();
    } catch (error) {
      showGlobalError(error);
    }
  }

  function updateNavShell() {
    const current = document.body.dataset.page;
    document.querySelectorAll('[data-nav]').forEach((link) => {
      link.classList.toggle('active', link.dataset.nav === current);
    });
  }

  function updateNavMetrics() {
    const goalChip = document.querySelector('[data-goal-chip]');
    const kcalChip = document.querySelector('[data-kcal-chip]');
    const selectedGoal = getSelectedGoal();
    if (goalChip) goalChip.textContent = `Goal: ${selectedGoal || '--'}`;
    if (kcalChip) {
      const totals = calculateTotals(getPlan()).totals;
      kcalChip.textContent = `${formatNumber(totals.calories)} kcal`;
    }
  }

  async function loadData() {
    const [mealsRows, profileRows, sampleRows, groceryRows] = await Promise.all([
      loadCSV('meals.csv'),
      loadCSV('nutrition_profiles.csv'),
      loadCSV('weekly_sample_plan.csv'),
      loadCSV('grocery_items.csv')
    ]);

    state.meals = mealsRows.map((row) => ({
      id: safe(row.ID || row.MealID),
      name: safe(row.Name || row.MealName),
      calories: toNumber(row.Calories),
      protein: toNumber(row.Protein),
      carbs: toNumber(row.Carbs),
      fats: toNumber(row.Fats || row.Fat),
      cuisine: safe(row.Cuisine),
      type: safe(row.Type),
      dietaryTags: splitTags(row.DietaryTags)
    })).filter((meal) => meal.id && meal.name);

    state.mealsById = new Map(state.meals.map((meal) => [meal.id, meal]));
    state.mealsByName = new Map(state.meals.map((meal) => [meal.name.toLowerCase(), meal]));

    state.profiles = profileRows.map((row) => ({
      goal: safe(row.Goal),
      minCal: toNumber(row.MinCal),
      maxCal: toNumber(row.MaxCal),
      minProt: toNumber(row.MinProt),
      maxProt: toNumber(row.MaxProt),
      minCarb: toNumber(row.MinCarb),
      maxCarb: toNumber(row.MaxCarb),
      minFat: toNumber(row.MinFat),
      maxFat: toNumber(row.MaxFat),
      breakfastPct: toNumber(row.BreakfastPct),
      lunchPct: toNumber(row.LunchPct),
      dinnerPct: toNumber(row.DinnerPct),
      snackPct: toNumber(row.SnackPct)
    })).filter((profile) => profile.goal);

    state.profilesByGoal = new Map(state.profiles.map((profile) => [profile.goal, profile]));

    state.samplePlan = sampleRows.map((row) => ({
      day: safe(row.Day),
      slot: safe(row.Slot),
      mealName: safe(row.MealName),
      mealId: safe(row.MealID),
      calories: toNumber(row.Calories),
      goal: safe(row.Goal)
    })).filter((row) => DAYS.includes(row.day) && SLOTS.includes(row.slot));

    state.grocery = groceryRows.map((row) => ({
      mealId: safe(row.MealID),
      mealName: safe(row.MealName),
      ingredient: safe(row.IngredientName),
      quantity: safe(row.Quantity),
      unit: safe(row.Unit),
      category: safe(row.Category) || 'Other',
      storeSection: safe(row.StoreSection)
    })).filter((row) => row.mealId && row.ingredient);
  }

  async function loadCSV(fileName) {
    const response = await fetch(`resources/${fileName}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load resources/${fileName}`);
    const text = await response.text();
    return parseCSV(text);
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (quoted && next === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
        continue;
      }

      if (char === ',' && !quoted) {
        row.push(cell);
        cell = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') i += 1;
        row.push(cell);
        if (row.some((value) => value.trim() !== '')) rows.push(row);
        row = [];
        cell = '';
        continue;
      }

      cell += char;
    }

    row.push(cell);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    if (!rows.length) return [];

    const headers = rows[0].map((heading) => heading.trim());
    return rows.slice(1).map((values) => {
      const output = {};
      headers.forEach((heading, index) => {
        output[heading] = safe(values[index]);
      });
      return output;
    });
  }

  function initLanding() {
    const cta = document.querySelector('[data-start-goals]');
    if (cta) cta.addEventListener('click', () => { window.location.href = 'mealmint-goals.html'; });
  }

  function initGoals() {
    const grid = document.querySelector('[data-goal-grid]');
    if (!grid) return;

    const selected = getSelectedGoal();

    const goalMeta = {
      'Muscle Gain': {
        label: 'Strength Focus',
        focus: 'Higher calories',
        support: 'Protein recovery'
      },
      'Weight Loss': {
        label: 'Calorie Control',
        focus: 'Lighter meals',
        support: 'Protein balance'
      },
      'Weight Maintenance': {
        label: 'Lifestyle Balance',
        focus: 'Stable intake',
        support: 'Macro rhythm'
      },
      'Endurance Training': {
        label: 'Training Fuel',
        focus: 'Carb energy',
        support: 'Weekly stamina'
      },
      'Balanced Healthy Eating': {
        label: 'Everyday Wellness',
        focus: 'Clean balance',
        support: 'Default baseline'
      },
      'Vegetarian or Vegan': {
        label: 'Plant Forward',
        focus: 'Vegetable meals',
        support: 'Dietary fit'
      },
      'High-Protein Low-Carb': {
        label: 'Macro Control',
        focus: 'More protein',
        support: 'Lower carbs'
      }
    };

    grid.innerHTML = GOALS.map((goal, index) => {
      const meta = goalMeta[goal.name] || {
        label: 'Nutrition Goal',
        focus: 'Meal planning',
        support: 'Weekly control'
      };

      const isActive = goal.name === selected;

      return `
      <article class="goal-option ${isActive ? 'active' : ''}" data-select-goal="${escapeHTML(goal.name)}" tabindex="0" role="button" aria-pressed="${isActive}">
        <div class="goal-option-top">
          <span class="goal-number">${String(index + 1).padStart(2, '0')}</span>
          <span class="goal-symbol">${goal.icon}</span>
        </div>

        <div class="goal-option-body">
          <h3>${escapeHTML(goal.name)}</h3>
          <p>${escapeHTML(goal.desc)}</p>
        </div>

        <div class="goal-mini-tags">
          <span>${escapeHTML(meta.focus)}</span>
          <span>${escapeHTML(meta.support)}</span>
        </div>

        <button class="btn ${isActive ? 'btn-success' : 'btn-primary'}" type="button">
          ${isActive ? 'Selected Goal' : 'Select Goal'}
        </button>
      </article>
    `;
    }).join('');

    const selectGoal = (goal) => {
      setSelectedGoal(goal);
      setPlan(buildDefaultPlan(goal));
      localStorage.removeItem(CHECKED_KEY);
      localStorage.removeItem(HIDDEN_KEY);
      showToast(`${goal} selected. Sample plan loaded.`);
      setTimeout(() => {
        window.location.href = 'mealmint-library.html';
      }, 450);
    };

    grid.addEventListener('click', (event) => {
      const card = event.target.closest('[data-select-goal]');
      if (!card) return;
      selectGoal(card.dataset.selectGoal);
    });

    grid.addEventListener('keydown', (event) => {
      const card = event.target.closest('[data-select-goal]');
      if (!card) return;

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectGoal(card.dataset.selectGoal);
      }
    });
  }

  function initLibrary() {
    const typeFilter = document.querySelector('[data-type-filter]');
    const cuisineFilter = document.querySelector('[data-cuisine-filter]');
    const searchInput = document.querySelector('[data-meal-search]');
    const grid = document.querySelector('[data-recipe-grid]');
    const count = document.querySelector('[data-result-count]');
    const profileLine = document.querySelector('[data-profile-line]');

    if (!grid) return;

    fillCuisineOptions(cuisineFilter);
    renderGoalContext(profileLine);

    const render = () => {
      const query = (searchInput?.value || '').trim().toLowerCase();
      const type = typeFilter?.value || 'All';
      const cuisine = cuisineFilter?.value || 'All';
      const meals = state.meals.filter((meal) => {
        const matchesType = type === 'All' || meal.type === type;
        const matchesCuisine = cuisine === 'All' || meal.cuisine === cuisine;
        const matchesQuery = !query || [meal.name, meal.type, meal.cuisine, meal.dietaryTags.join(' ')].join(' ').toLowerCase().includes(query);
        return matchesType && matchesCuisine && matchesQuery;
      });

      if (count) count.textContent = `${meals.length} meal${meals.length === 1 ? '' : 's'} found`;
      grid.innerHTML = meals.map((meal) => recipeCard(meal)).join('') || emptyMarkup('No meals found for the current filters.');
    };

    [typeFilter, cuisineFilter, searchInput].forEach((input) => input?.addEventListener('input', render));
    grid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-add-meal]');
      if (!button) return;
      const meal = state.mealsById.get(button.dataset.addMeal);
      if (meal) openAssignModal(meal);
    });
    document.querySelector('[data-reset-filters]')?.addEventListener('click', () => {
      if (typeFilter) typeFilter.value = 'All';
      if (cuisineFilter) cuisineFilter.value = 'All';
      if (searchInput) searchInput.value = '';
      render();
    });

    render();
  }

  function recipeCard(meal) {
    const fit = mealFitForGoal(meal);
    const tags = [meal.type, meal.cuisine, ...meal.dietaryTags.slice(0, 2)].filter(Boolean);
    return `
      <article class="recipe-card card">
        <div class="recipe-tags">
          ${tags.map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}
          <span class="tag ${fit.level === 'good' ? 'mint' : 'warn'}">${escapeHTML(fit.label)}</span>
        </div>
        <h3>${escapeHTML(meal.name)}</h3>
        <p class="recipe-meta">${escapeHTML(meal.cuisine)} cuisine · ${escapeHTML(meal.type)}</p>
        <div class="macro-row">
          <div class="macro-pill"><strong>${formatNumber(meal.calories)}</strong><span class="recipe-meta">kcal</span></div>
          <div class="macro-pill"><strong>${formatNumber(meal.protein)}g</strong><span class="recipe-meta">protein</span></div>
          <div class="macro-pill"><strong>${formatNumber(meal.carbs)}g</strong><span class="recipe-meta">carbs</span></div>
          <div class="macro-pill"><strong>${formatNumber(meal.fats)}g</strong><span class="recipe-meta">fat</span></div>
        </div>
        <div class="recipe-actions">
          <span class="helper-text">Goal: ${escapeHTML(getSelectedGoal() || DEFAULT_GOAL)}</span>
          <button class="btn btn-primary btn-small" data-add-meal="${escapeHTML(meal.id)}">Add to Plan</button>
        </div>
      </article>
    `;
  }

  function initPlanner() {
    const board = document.querySelector('[data-planner-board]');
    const clearButton = document.querySelector('[data-clear-plan]');
    const dashboardButton = document.querySelector('[data-view-dashboard]');
    if (!board) return;

    const render = () => {
      renderPlannerBoard(board);
      renderPlannerSummary();
      updateNavMetrics();
    };

    board.addEventListener('click', (event) => {
      const addButton = event.target.closest('[data-add-slot]');
      const removeButton = event.target.closest('[data-remove-slot]');
      if (addButton) {
        openMealPicker(addButton.dataset.day, addButton.dataset.slot, render);
      }
      if (removeButton) {
        const plan = getPlan();
        plan[removeButton.dataset.day][removeButton.dataset.slot] = null;
        setPlan(plan);
        render();
        showToast('Meal removed from planner.');
      }
    });

    clearButton?.addEventListener('click', () => {
      openConfirm({
        title: 'Clear all meals?',
        message: 'This will remove every meal from the weekly planner and update the dashboard and grocery list.',
        confirmText: 'Clear All Plan',
        danger: true,
        onConfirm: () => {
          setPlan(emptyPlan());
          localStorage.removeItem(CHECKED_KEY);
          localStorage.removeItem(HIDDEN_KEY);
          render();
          showToast('Weekly planner cleared.');
        }
      });
    });

    dashboardButton?.addEventListener('click', () => { window.location.href = 'mealmint-dashboard.html'; });
    render();
  }

  function renderPlannerBoard(board) {
    const plan = getPlan();
    const totals = calculateTotals(plan).daily;
    let html = '<div class="planner-grid">';
    html += '<div class="slot-head"></div>';
    DAYS.forEach((day) => { html += `<div class="day-head">${day}</div>`; });

    SLOTS.forEach((slot) => {
      html += `<div class="slot-head">${slot}</div>`;
      DAYS.forEach((day) => {
        const meal = getMealFromPlan(plan, day, slot);
        html += `<div class="meal-cell ${meal ? 'filled' : ''}">`;
        if (meal) {
          html += `
            <div class="meal-card-mini">
              <div class="meal-name">${escapeHTML(meal.name)}</div>
              <div class="recipe-meta">${formatNumber(meal.calories)} kcal · P ${formatNumber(meal.protein)}g · C ${formatNumber(meal.carbs)}g · F ${formatNumber(meal.fats)}g</div>
              <button class="btn btn-secondary btn-small no-print" data-remove-slot="1" data-day="${day}" data-slot="${slot}">Remove</button>
            </div>
          `;
        } else {
          html += `<button class="empty-meal-btn no-print" data-add-slot="1" data-day="${day}" data-slot="${slot}"><span>+</span><span>Add Meal</span></button>`;
        }
        html += '</div>';
      });
    });

    html += '<div></div>';
    DAYS.forEach((day) => {
      html += `<div class="total-cell"><span>Daily Total</span>${formatNumber(totals[day].calories)} kcal</div>`;
    });
    html += '</div>';
    board.innerHTML = html;
  }

  function renderPlannerSummary() {
    const panel = document.querySelector('[data-planner-summary]');
    if (!panel) return;
    const plan = getPlan();
    const result = calculateTotals(plan);
    const status = nutritionStatus(result.totals, getActiveProfile(), true);

    panel.innerHTML = `
      <p class="eyebrow muted">Planner Summary</p>
      <h2>Weekly Summary</h2>
      <div class="summary-metrics">
        ${summaryMetric('Total Calories', `${formatNumber(result.totals.calories)} kcal`)}
        ${summaryMetric('Protein', `${formatNumber(result.totals.protein)}g`)}
        ${summaryMetric('Carbs', `${formatNumber(result.totals.carbs)}g`)}
        ${summaryMetric('Fat', `${formatNumber(result.totals.fats)}g`)}
      </div>
      ${progressMarkup('Goal Comparison', result.totals.calories, getActiveProfile().maxCal * 7, status.overLimit ? 'warning' : 'success')}
      ${progressMarkup('Protein Progress', result.totals.protein, getActiveProfile().maxProt * 7, status.proteinOk ? 'success' : 'warning')}
      <div class="status-strip ${status.level === 'success' ? '' : 'warning'}">Nutrition Status: <strong>${escapeHTML(status.label)}</strong></div>
      <p class="helper-text">Notes / placeholder text area for additional planning tips or reminders.</p>
      <button class="btn btn-secondary" data-view-dashboard>View Dashboard</button>
    `;

    panel.querySelector('[data-view-dashboard]')?.addEventListener('click', () => { window.location.href = 'mealmint-dashboard.html'; });
  }

  function initDashboard() {
    const result = calculateTotals(getPlan());
    const profile = getActiveProfile();
    const status = nutritionStatus(result.totals, profile, true);

    const alert = document.querySelector('[data-dashboard-alert]');
    if (alert) {
      alert.className = `status-strip ${status.level === 'success' ? '' : 'warning'}`;
      alert.innerHTML = status.level === 'success'
        ? `<strong>Green success:</strong> ${escapeHTML(status.message)}`
        : `<strong>Amber alert:</strong> ${escapeHTML(status.message)}`;
    }

    const metrics = document.querySelector('[data-metric-grid]');
    if (metrics) metrics.innerHTML = dashboardMetricCards(result, profile);

    const table = document.querySelector('[data-daily-table]');
    if (table) table.innerHTML = dailyTable(result);

    const side = document.querySelector('[data-dashboard-side]');
    if (side) side.innerHTML = dashboardSide(result, profile, status);

    const compare = document.querySelector('[data-goal-compare]');
    if (compare) compare.innerHTML = goalComparison(result, profile);

    const insights = document.querySelector('[data-insights]');
    if (insights) insights.innerHTML = insightsMarkup(result, profile, status);

    document.querySelector('[data-print-summary]')?.addEventListener('click', () => window.print());
  }

  function dashboardMetricCards(result, profile) {
    const metrics = [
      { key: 'calories', title: 'Weekly Total Calories', value: result.totals.calories, suffix: 'kcal', min: profile.minCal * 7, max: profile.maxCal * 7 },
      { key: 'protein', title: 'Weekly Total Protein', value: result.totals.protein, suffix: 'g', min: profile.minProt * 7, max: profile.maxProt * 7 },
      { key: 'carbs', title: 'Weekly Total Carbs', value: result.totals.carbs, suffix: 'g', min: profile.minCarb * 7, max: profile.maxCarb * 7 },
      { key: 'fats', title: 'Weekly Total Fats', value: result.totals.fats, suffix: 'g', min: profile.minFat * 7, max: profile.maxFat * 7 }
    ];

    return metrics.map((metric) => {
      const status = metricStatus(metric.value, metric.min, metric.max);
      const days = DAYS.map((day) => result.daily[day][metric.key]);
      return `
        <article class="metric-card card ${status.level}">
          <h3>${metric.title}</h3>
          <div class="metric-value">${formatNumber(metric.value)} ${metric.suffix}</div>
          <p class="metric-muted">Calculated against active profile baseline</p>
          ${sparkline(days)}
          <div class="metric-muted">Trend: ${trendText(metric.value, metric.max)} vs Baseline (7Day)</div>
          <div class="metric-badge">${status.short}</div>
        </article>
      `;
    }).join('');
  }

  function dailyTable(result) {
    let rows = DAYS.map((day) => `
      <tr>
        <td>${day}</td>
        <td>${formatNumber(result.daily[day].calories)}</td>
        <td>${formatNumber(result.daily[day].protein)}g</td>
        <td>${formatNumber(result.daily[day].carbs)}g</td>
        <td>${formatNumber(result.daily[day].fats)}g</td>
      </tr>
    `).join('');

    rows += `
      <tr class="total-row">
        <td>Weekly Total</td>
        <td>${formatNumber(result.totals.calories)}</td>
        <td>${formatNumber(result.totals.protein)}g</td>
        <td>${formatNumber(result.totals.carbs)}g</td>
        <td>${formatNumber(result.totals.fats)}g</td>
      </tr>
    `;

    return `
      <table class="table-green">
        <thead>
          <tr><th>Day</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fats</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function dashboardSide(result, profile, status) {
    return `
      <div class="info-card card">
        <p class="eyebrow muted">Selected Goal</p>
        <h3>${escapeHTML(getSelectedGoal() || DEFAULT_GOAL)}</h3>
        <p class="helper-text">Baseline profile loaded from nutrition_profiles.csv</p>
      </div>
      <div class="info-card card">
        <p class="eyebrow muted">Nutrition Status</p>
        <h2>Status: ${escapeHTML(status.label)}</h2>
        <div class="modal-grid">
          <div class="notice"><strong>${status.level === 'success' ? 'Success Message' : 'Review Needed'}</strong></div>
          <div class="notice"><strong>${status.overLimit ? 'Warning Message' : 'No Critical Warning'}</strong></div>
        </div>
      </div>
      <div class="info-card card">
        <p class="eyebrow muted">Recommended Daily Range</p>
        ${compareLine('Calories', `${formatNumber(profile.minCal)}-${formatNumber(profile.maxCal)} kcal`)}
        ${compareLine('Protein', `${formatNumber(profile.minProt)}-${formatNumber(profile.maxProt)}g`)}
        ${compareLine('Carbs', `${formatNumber(profile.minCarb)}-${formatNumber(profile.maxCarb)}g`)}
        ${compareLine('Fat', `${formatNumber(profile.minFat)}-${formatNumber(profile.maxFat)}g`)}
      </div>
      <div class="info-card card no-print">
        <p class="eyebrow muted">Quick Actions</p>
        <div class="modal-grid">
          <a class="btn btn-secondary" href="mealmint-planner.html">Edit Planner</a>
          <a class="btn btn-secondary" href="mealmint-grocery.html">Generate Grocery List</a>
        </div>
      </div>
      <div class="info-card card">
        <p class="eyebrow muted">Weekly Progress</p>
        ${progressMarkup('Calories', result.totals.calories, profile.maxCal * 7, status.caloriesOk ? 'success' : 'warning')}
        ${progressMarkup('Protein', result.totals.protein, profile.maxProt * 7, status.proteinOk ? 'success' : 'warning')}
        ${progressMarkup('Carbs', result.totals.carbs, profile.maxCarb * 7, status.carbsOk ? 'success' : 'warning')}
      </div>
    `;
  }

  function goalComparison(result, profile) {
    return `
      <div class="compare-box card">
        <h3>Recommended Nutrition</h3>
        ${compareLine('Calories', `${formatNumber(profile.minCal * 7)}-${formatNumber(profile.maxCal * 7)} kcal`)}
        ${compareLine('Protein', `${formatNumber(profile.minProt * 7)}-${formatNumber(profile.maxProt * 7)}g`)}
        ${compareLine('Carbs', `${formatNumber(profile.minCarb * 7)}-${formatNumber(profile.maxCarb * 7)}g`)}
        ${compareLine('Fat', `${formatNumber(profile.minFat * 7)}-${formatNumber(profile.maxFat * 7)}g`)}
      </div>
      <div class="vs">VS</div>
      <div class="compare-box card">
        <h3>Actual Weekly Totals</h3>
        ${compareLine('Calories', `${formatNumber(result.totals.calories)} kcal`)}
        ${compareLine('Protein', `${formatNumber(result.totals.protein)}g`)}
        ${compareLine('Carbs', `${formatNumber(result.totals.carbs)}g`)}
        ${compareLine('Fat', `${formatNumber(result.totals.fats)}g`)}
      </div>
    `;
  }

  function insightsMarkup(result, profile, status) {
    const lines = [];
    if (status.level === 'success') {
      lines.push('Your weekly plan is inside the selected goal baseline, so MealMint marks this schedule as compliant.');
    } else {
      lines.push(status.message);
    }

    const highestDay = DAYS.slice().sort((a, b) => result.daily[b].calories - result.daily[a].calories)[0];
    const lowestDay = DAYS.slice().sort((a, b) => result.daily[a].calories - result.daily[b].calories)[0];
    lines.push(`${highestDay} has the highest calorie load at ${formatNumber(result.daily[highestDay].calories)} kcal.`);
    lines.push(`${lowestDay} has the lightest calorie load at ${formatNumber(result.daily[lowestDay].calories)} kcal.`);
    lines.push(`The active daily calorie baseline is ${formatNumber(profile.minCal)}-${formatNumber(profile.maxCal)} kcal for ${escapeHTML(getSelectedGoal() || DEFAULT_GOAL)}.`);

    return lines.map((line) => `<div class="insight-line">${line}</div>`).join('');
  }

  function initGrocery() {
    const list = document.querySelector('[data-grocery-list]');
    const side = document.querySelector('[data-grocery-side]');
    if (!list) return;

    const render = () => {
      const compiled = compileGroceryList();
      renderGroceryList(list, compiled);
      renderGrocerySide(side, compiled);
      updateNavMetrics();
    };

    list.addEventListener('change', (event) => {
      const input = event.target.closest('[data-grocery-check]');
      if (!input) return;
      const checked = readSet(CHECKED_KEY);
      if (input.checked) checked.add(input.dataset.groceryCheck);
      else checked.delete(input.dataset.groceryCheck);
      writeSet(CHECKED_KEY, checked);
      input.closest('.grocery-item')?.classList.toggle('checked', input.checked);
    });

    document.querySelector('[data-print-grocery]')?.addEventListener('click', () => window.print());
    document.querySelector('[data-clear-checked]')?.addEventListener('click', () => {
      const checked = readSet(CHECKED_KEY);
      if (!checked.size) {
        showToast('No checked grocery lines to clear.');
        return;
      }
      const hidden = readSet(HIDDEN_KEY);
      checked.forEach((item) => hidden.add(item));
      writeSet(HIDDEN_KEY, hidden);
      localStorage.removeItem(CHECKED_KEY);
      render();
      showToast('Checked grocery lines cleared.');
    });
    document.querySelector('[data-reset-grocery]')?.addEventListener('click', () => {
      localStorage.removeItem(CHECKED_KEY);
      localStorage.removeItem(HIDDEN_KEY);
      render();
      showToast('Grocery checklist reset.');
    });

    render();
  }

  function renderGroceryList(list, compiled) {
    const checked = readSet(CHECKED_KEY);
    const hidden = readSet(HIDDEN_KEY);
    const visible = compiled.filter((item) => !hidden.has(item.id));

    if (!visible.length) {
      list.innerHTML = emptyMarkup('No grocery items to show. Add meals in the planner or reset cleared grocery lines.');
      return;
    }

    const groups = groupBy(visible, (item) => item.category);
    list.innerHTML = Object.keys(groups).sort().map((category) => `
      <section class="grocery-group">
        <h2>${escapeHTML(category)}</h2>
        <div class="group-body">
          ${groups[category].map((item) => {
      const isChecked = checked.has(item.id);
      return `
              <label class="grocery-item ${isChecked ? 'checked' : ''}">
                <input type="checkbox" data-grocery-check="${escapeHTML(item.id)}" ${isChecked ? 'checked' : ''}>
                <span>
                  <span class="item-name">${escapeHTML(item.ingredient)}</span>
                  <span class="item-sub">${escapeHTML(item.storeSection || 'General')} · ${item.mealNames.map(escapeHTML).join(', ')}</span>
                </span>
                <span class="qty">${escapeHTML(item.quantityLabel)}</span>
              </label>
            `;
    }).join('')}
        </div>
      </section>
    `).join('');
  }

  function renderGrocerySide(side, compiled) {
    if (!side) return;
    const hidden = readSet(HIDDEN_KEY);
    const visible = compiled.filter((item) => !hidden.has(item.id));
    const plan = getPlan();
    const result = calculateTotals(plan);
    const uniqueMeals = unique(plannedMealIds(plan)).length;
    const categories = unique(visible.map((item) => item.category)).length;
    side.innerHTML = `
      <p class="eyebrow muted">Shopping Summary</p>
      <h2>Consolidated Grocery List</h2>
      <div class="summary-metrics">
        ${summaryMetric('Meal Slots', `${plannedMealIds(plan).length}`)}
        ${summaryMetric('Unique Meals', `${uniqueMeals}`)}
        ${summaryMetric('Categories', `${categories}`)}
        ${summaryMetric('Items', `${visible.length}`)}
      </div>
      <p class="helper-text">This list is generated by mapping your active planner against grocery_items.csv and grouping ingredients by category.</p>
      ${progressMarkup('Weekly Calories', result.totals.calories, getActiveProfile().maxCal * 7, 'success')}
      <a class="btn btn-secondary" href="mealmint-planner.html">Back to Planner</a>
    `;
  }

  function compileGroceryList() {
    const mealIds = plannedMealIds(getPlan());
    const wanted = new Set(mealIds);
    const accumulator = new Map();

    state.grocery.filter((row) => wanted.has(row.mealId)).forEach((row) => {
      const key = [row.category, row.ingredient, row.unit, row.storeSection].join('|').toLowerCase();
      const current = accumulator.get(key) || {
        id: key,
        category: row.category,
        ingredient: row.ingredient,
        unit: row.unit,
        storeSection: row.storeSection,
        mealNames: [],
        amount: 0,
        quantityPieces: [],
        numeric: true
      };
      const parsed = parseQuantity(row.quantity);
      if (parsed.numeric) {
        current.amount += parsed.value * countOccurrences(mealIds, row.mealId);
      } else {
        current.numeric = false;
        current.quantityPieces.push(row.quantity);
      }
      current.mealNames.push(row.mealName);
      accumulator.set(key, current);
    });

    return Array.from(accumulator.values()).map((item) => {
      item.mealNames = unique(item.mealNames);
      item.quantityLabel = item.numeric
        ? `${trimNumber(item.amount)} ${item.unit || ''}`.trim()
        : unique(item.quantityPieces).join(' + ');
      return item;
    });
  }

  function openAssignModal(meal, presetDay = '', presetSlot = '') {
    const modal = createModal({ title: `Add ${meal.name}`, wide: false });
    modal.body.innerHTML = `
      <p class="helper-text">Choose a day and meal slot. The planner auto-saves locally after assignment.</p>
      <div class="modal-grid">
        <label>Day<select class="field" data-modal-day>${DAYS.map((day) => `<option ${day === presetDay ? 'selected' : ''}>${day}</option>`).join('')}</select></label>
        <label>Slot<select class="field" data-modal-slot>${SLOTS.map((slot) => `<option ${slot === presetSlot ? 'selected' : ''}>${slot}</option>`).join('')}</select></label>
      </div>
      <div class="notice" style="margin-top:14px"><strong>${escapeHTML(meal.name)}</strong><br>${formatNumber(meal.calories)} kcal · ${formatNumber(meal.protein)}g protein · ${formatNumber(meal.carbs)}g carbs · ${formatNumber(meal.fats)}g fat</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close-modal>Cancel</button>
        <button class="btn btn-primary" data-save-assignment>Save to Planner</button>
      </div>
    `;
    modal.el.querySelector('[data-save-assignment]')?.addEventListener('click', () => {
      const day = modal.el.querySelector('[data-modal-day]').value;
      const slot = modal.el.querySelector('[data-modal-slot]').value;
      const plan = getPlan();
      plan[day][slot] = meal.id;
      setPlan(plan);
      closeModal(modal.el);
      updateNavMetrics();
      showToast(`${meal.name} added to ${day} ${slot}.`);
    });
  }

  function openMealPicker(day, slot, onDone) {
    const modal = createModal({ title: `Add Meal · ${day} ${slot}`, wide: true });
    const profileText = `${getSelectedGoal() || DEFAULT_GOAL} recommendation active`;
    modal.body.innerHTML = `
      <p class="helper-text">${escapeHTML(profileText)}. Search the meal library and place one item into this calendar cell.</p>
      <input class="field" data-picker-search placeholder="Search meals by name, type, cuisine, or tag">
      <div class="picker-results" data-picker-results></div>
    `;
    const input = modal.el.querySelector('[data-picker-search]');
    const results = modal.el.querySelector('[data-picker-results]');
    const render = () => {
      const query = input.value.trim().toLowerCase();
      const meals = state.meals.filter((meal) => !query || [meal.name, meal.type, meal.cuisine, meal.dietaryTags.join(' ')].join(' ').toLowerCase().includes(query)).slice(0, 40);
      results.innerHTML = meals.map((meal) => `
        <div class="picker-item">
          <div>
            <strong>${escapeHTML(meal.name)}</strong>
            <div class="recipe-meta">${escapeHTML(meal.type)} · ${escapeHTML(meal.cuisine)} · ${formatNumber(meal.calories)} kcal · P ${formatNumber(meal.protein)}g</div>
          </div>
          <button class="btn btn-primary btn-small" data-pick-meal="${escapeHTML(meal.id)}">Add</button>
        </div>
      `).join('') || emptyMarkup('No matching meals found.');
    };
    input.addEventListener('input', render);
    results.addEventListener('click', (event) => {
      const pick = event.target.closest('[data-pick-meal]');
      if (!pick) return;
      const meal = state.mealsById.get(pick.dataset.pickMeal);
      const plan = getPlan();
      plan[day][slot] = meal.id;
      setPlan(plan);
      closeModal(modal.el);
      showToast(`${meal.name} added to ${day} ${slot}.`);
      if (typeof onDone === 'function') onDone();
    });
    render();
    setTimeout(() => input.focus(), 60);
  }

  function openConfirm({ title, message, confirmText, danger, onConfirm }) {
    const modal = createModal({ title, wide: false });
    modal.body.innerHTML = `
      <p>${escapeHTML(message)}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close-modal>Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm-action>${escapeHTML(confirmText || 'Confirm')}</button>
      </div>
    `;
    modal.el.querySelector('[data-confirm-action]')?.addEventListener('click', () => {
      closeModal(modal.el);
      if (typeof onConfirm === 'function') onConfirm();
    });
  }

  function createModal({ title, wide }) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}">
        <div class="modal-head">
          <h2>${escapeHTML(title)}</h2>
          <button class="close-modal" type="button" aria-label="Close" data-close-modal>×</button>
        </div>
        <div data-modal-body></div>
      </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop || event.target.closest('[data-close-modal]')) closeModal(backdrop);
    });
    document.addEventListener('keydown', escModalCloser);
    return { el: backdrop, body: backdrop.querySelector('[data-modal-body]') };
  }

  function closeModal(backdrop) {
    document.removeEventListener('keydown', escModalCloser);
    backdrop.remove();
  }

  function escModalCloser(event) {
    if (event.key === 'Escape') {
      const modal = document.querySelector('.modal-backdrop');
      if (modal) closeModal(modal);
    }
  }

  function fillCuisineOptions(select) {
    if (!select) return;
    const cuisines = unique(state.meals.map((meal) => meal.cuisine).filter(Boolean)).sort();
    select.innerHTML = '<option value="All">All Cuisines</option>' + cuisines.map((cuisine) => `<option value="${escapeHTML(cuisine)}">${escapeHTML(cuisine)}</option>`).join('');
  }

  function renderGoalContext(target) {
    if (!target) return;
    const profile = getActiveProfile();
    target.innerHTML = `
      <strong>Selected Goal:</strong> ${escapeHTML(getSelectedGoal() || '--')} ·
      Daily Calories ${formatNumber(profile.minCal)}-${formatNumber(profile.maxCal)} kcal ·
      Protein ${formatNumber(profile.minProt)}-${formatNumber(profile.maxProt)}g
    `;
  }

  function mealFitForGoal(meal) {
    const profile = getActiveProfile();
    const slotPct = {
      Breakfast: profile.breakfastPct,
      Lunch: profile.lunchPct,
      Dinner: profile.dinnerPct,
      Snack: profile.snackPct
    }[meal.type] || 25;
    const max = profile.maxCal * (slotPct / 100);
    const min = profile.minCal * (slotPct / 100) * 0.65;
    if (meal.calories >= min && meal.calories <= max) return { level: 'good', label: 'Range Fit' };
    if (meal.calories > max) return { level: 'warn', label: 'High Energy' };
    return { level: 'warn', label: 'Light Option' };
  }

  function hydratePlanIfNeeded() {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) setPlan(buildDefaultPlan(getSelectedGoal() || DEFAULT_GOAL));
  }

  function emptyPlan() {
    const plan = {};
    DAYS.forEach((day) => {
      plan[day] = {};
      SLOTS.forEach((slot) => { plan[day][slot] = null; });
    });
    return plan;
  }

  function buildDefaultPlan(goal) {
    const plan = emptyPlan();
    const selectedGoal = goal || DEFAULT_GOAL;
    let rows = state.samplePlan.filter((row) => row.goal === selectedGoal);
    if (!rows.length) rows = state.samplePlan.filter((row) => row.goal === DEFAULT_GOAL);
    rows.forEach((row) => {
      const meal = state.mealsById.get(row.mealId) || state.mealsByName.get(row.mealName.toLowerCase());
      if (meal) plan[row.day][row.slot] = meal.id;
    });
    return plan;
  }

  function getPlan() {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return buildDefaultPlan(getSelectedGoal() || DEFAULT_GOAL);
    try {
      const parsed = JSON.parse(raw);
      const plan = emptyPlan();
      DAYS.forEach((day) => {
        SLOTS.forEach((slot) => {
          plan[day][slot] = parsed?.[day]?.[slot] || null;
        });
      });
      return plan;
    } catch (_) {
      return buildDefaultPlan(getSelectedGoal() || DEFAULT_GOAL);
    }
  }

  function setPlan(plan) {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    updateNavMetrics();
  }

  function getSelectedGoal() {
    return localStorage.getItem(GOAL_KEY);
  }

  function setSelectedGoal(goal) {
    localStorage.setItem(GOAL_KEY, goal);
  }

  function getActiveProfile() {
    return state.profilesByGoal.get(getSelectedGoal() || DEFAULT_GOAL) || state.profilesByGoal.get(DEFAULT_GOAL) || state.profiles[0];
  }

  function getMealFromPlan(plan, day, slot) {
    const id = plan?.[day]?.[slot];
    return id ? state.mealsById.get(id) : null;
  }

  function calculateTotals(plan) {
    const daily = {};
    const totals = { calories: 0, protein: 0, carbs: 0, fats: 0 };
    DAYS.forEach((day) => {
      daily[day] = { calories: 0, protein: 0, carbs: 0, fats: 0 };
      SLOTS.forEach((slot) => {
        const meal = getMealFromPlan(plan, day, slot);
        if (!meal) return;
        daily[day].calories += meal.calories;
        daily[day].protein += meal.protein;
        daily[day].carbs += meal.carbs;
        daily[day].fats += meal.fats;
      });
      totals.calories += daily[day].calories;
      totals.protein += daily[day].protein;
      totals.carbs += daily[day].carbs;
      totals.fats += daily[day].fats;
    });
    return { daily, totals };
  }

  function nutritionStatus(totals, profile, weekly) {
    const multiplier = weekly ? 7 : 1;
    const ranges = {
      calories: [profile.minCal * multiplier, profile.maxCal * multiplier],
      protein: [profile.minProt * multiplier, profile.maxProt * multiplier],
      carbs: [profile.minCarb * multiplier, profile.maxCarb * multiplier],
      fats: [profile.minFat * multiplier, profile.maxFat * multiplier]
    };
    const flags = Object.fromEntries(Object.entries(ranges).map(([key, [min, max]]) => [key, totals[key] >= min && totals[key] <= max]));
    const overLimitKeys = Object.entries(ranges).filter(([key, [, max]]) => totals[key] > max * 1.1).map(([key]) => key);
    const underKeys = Object.entries(ranges).filter(([key, [min]]) => totals[key] < min).map(([key]) => key);

    if (overLimitKeys.length) {
      return {
        level: 'warning',
        label: 'Over Limit',
        message: `${titleCase(overLimitKeys.join(', '))} is more than 10% above the selected profile threshold.`,
        overLimit: true,
        caloriesOk: flags.calories,
        proteinOk: flags.protein,
        carbsOk: flags.carbs,
        fatsOk: flags.fats
      };
    }

    if (underKeys.length) {
      return {
        level: 'warning',
        label: 'Below Target',
        message: `${titleCase(underKeys.join(', '))} is below the selected weekly profile baseline.`,
        overLimit: false,
        caloriesOk: flags.calories,
        proteinOk: flags.protein,
        carbsOk: flags.carbs,
        fatsOk: flags.fats
      };
    }

    return {
      level: 'success',
      label: 'Compliant',
      message: 'Your active weekly plan is within the selected nutrition profile range.',
      overLimit: false,
      caloriesOk: true,
      proteinOk: true,
      carbsOk: true,
      fatsOk: true
    };
  }

  function metricStatus(value, min, max) {
    if (value > max * 1.1) return { level: 'warning', short: 'Over Limit' };
    if (value < min) return { level: 'warning', short: 'Low Target' };
    return { level: 'success', short: 'Compliant' };
  }

  function plannedMealIds(plan) {
    const ids = [];
    DAYS.forEach((day) => SLOTS.forEach((slot) => {
      if (plan?.[day]?.[slot]) ids.push(plan[day][slot]);
    }));
    return ids;
  }

  function progressMarkup(label, value, max, level = '') {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    return `
      <div class="progress-row">
        <label><span>${escapeHTML(label)}</span><span>${pct}%</span></label>
        <div class="progress-track"><div class="progress-fill ${escapeHTML(level)}" style="width:${pct}%"></div></div>
      </div>
    `;
  }

  function summaryMetric(label, value) {
    return `<div class="summary-metric"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`;
  }

  function compareLine(label, value) {
    return `<div class="compare-line"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`;
  }

  function sparkline(values) {
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const points = values.map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 38 - ((value - min) / range) * 30;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
    return `<svg class="sparkline" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}"></polyline></svg>`;
  }

  function trendText(value, max) {
    if (!max) return '+0%';
    const pct = Math.round(((value - max) / max) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  }

  function showGlobalError(error) {
    const container = document.querySelector('main .container') || document.querySelector('main') || document.body;
    const message = error?.message || 'Unknown loading error';
    const block = document.createElement('div');
    block.className = 'container';
    block.innerHTML = `
      <div class="status-strip danger">
        <strong>MealMint could not load the CSV resources.</strong><br>
        ${escapeHTML(message)}<br><br>
        Open the project through a static server such as VS Code Live Server or <code>python -m http.server</code>. Direct file:// opening can block browser Fetch API access to CSV files.
      </div>
    `;
    container.prepend(block);
    console.error(error);
  }

  function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2500);
  }

  function emptyMarkup(message) {
    return `<div class="empty-state">${escapeHTML(message)}</div>`;
  }

  function safe(value) {
    return (value ?? '').toString().trim();
  }

  function toNumber(value) {
    const number = Number.parseFloat(safe(value).replace(/,/g, ''));
    return Number.isFinite(number) ? number : 0;
  }

  function splitTags(value) {
    return safe(value).split(';').map((tag) => tag.trim()).filter(Boolean);
  }

  function escapeHTML(value) {
    return safe(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatNumber(value) {
    return Math.round(Number(value) || 0).toLocaleString('en-US');
  }

  function trimNumber(value) {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  }

  function titleCase(value) {
    return safe(value).replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function unique(array) {
    return Array.from(new Set(array.filter(Boolean)));
  }

  function groupBy(array, getter) {
    return array.reduce((acc, item) => {
      const key = getter(item);
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
  }

  function parseQuantity(quantity) {
    const text = safe(quantity);
    const match = text.match(/^(-?\d+(?:\.\d+)?)/);
    if (!match) return { numeric: false, value: 0 };
    return { numeric: true, value: Number.parseFloat(match[1]) };
  }

  function countOccurrences(array, value) {
    return array.filter((item) => item === value).length || 1;
  }

  function readSet(key) {
    try {
      return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
    } catch (_) {
      return new Set();
    }
  }

  function writeSet(key, set) {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  }
})();
