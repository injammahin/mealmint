MealMint Health Labs - Static Browser Web Project

Entry page:
  mealmint-index.html

Pages included:
  1. mealmint-index.html      - Landing workspace
  2. mealmint-goals.html      - Goal selection
  3. mealmint-library.html    - Recipe library with search and filters
  4. mealmint-planner.html    - Seven-day weekly planner
  5. mealmint-dashboard.html  - Nutrition dashboard
  6. mealmint-grocery.html    - Consolidated grocery checklist

Resource CSV files:
  resources/meals.csv
  resources/nutrition_profiles.csv
  resources/weekly_sample_plan.csv
  resources/grocery_items.csv

Tech stack:
  HTML5, CSS3, Vanilla JavaScript ES6+
  No database, no login, no server-side language
  Browser localStorage for goal, planner, and grocery checklist state
  CSV files are loaded at runtime using browser Fetch API and parsed client-side

How to run:
  Best option: open the folder with VS Code Live Server or any static server.
  Example:
    cd mealmint_project
    python -m http.server 8000
  Then open:
    http://localhost:8000/mealmint-index.html

Important:
  Some browsers block Fetch API access to local CSV files when opening HTML directly with file://.
  Use a static server for reliable CSV loading.

Brand slogan:
   
