import { TestDatabaseAdapter } from "./dbHarness";
import { runFoodBudgetMigrations } from "../foodBudget";
import { 
  grow, 
  projectIngredientCostPerCalorie, 
  projectDtcCostPerCalorie,
  projectedCrossingDate
} from "../foodBudgetProjection";

describe("Food Budget Projection Tests", () => {
  let dbAdapter: TestDatabaseAdapter;

  beforeEach(async () => {
    dbAdapter = new TestDatabaseAdapter();
    await dbAdapter.initTestDb();
    await dbAdapter.runFoodBudgetMigrations();
  });

  afterEach(async () => {
    await dbAdapter.close();
  });

  test("should grow value correctly over time", () => {
    const initialValue = 100;
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2024-01-01'); // 1 year later
    const annualRate = 0.05; // 5% annual growth
    
    const result = grow(initialValue, startDate, endDate, annualRate);
    
    // Should grow by 5% over 1 year
    expect(result).toBeCloseTo(105, 2);
  });

  test("should project ingredient cost per calorie correctly", () => {
    const baseCostPerCalorie = 0.02; // 2 cents per calorie
    const baseDate = new Date('2023-01-01');
    const targetDate = new Date('2024-01-01');
    const annualInflationRate = 0.03; // 3% inflation
    
    const result = projectIngredientCostPerCalorie(
      baseCostPerCalorie,
      baseDate,
      targetDate,
      annualInflationRate
    );
    
    // Should be higher due to inflation
    expect(result).toBeGreaterThan(baseCostPerCalorie);
  });

  test("should project DTC cost per calorie correctly", () => {
    const baseDtc = 100; // 100 calories per dollar
    const baseDate = new Date('2023-01-01');
    const targetDate = new Date('2024-01-01');
    const annualInflationRate = 0.03; // 3% inflation
    
    const result = projectDtcCostPerCalorie(
      baseDtc,
      baseDate,
      targetDate,
      annualInflationRate
    );
    
    // Should be lower due to inflation (higher cost means lower DTC)
    expect(result).toBeLessThan(baseDtc);
  });

  test("should handle projected crossing date (returns null for now)", () => {
    const ingredientCostPerCalorie = 0.02;
    const dtcCostPerCalorie = 0.01;
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2025-01-01');
    const annualInflationRate = 0.03;
    
    const result = projectedCrossingDate(
      ingredientCostPerCalorie,
      dtcCostPerCalorie,
      startDate,
      endDate,
      annualInflationRate
    );
    
    // This is a stub implementation that returns null
    expect(result).toBeNull();
  });
});