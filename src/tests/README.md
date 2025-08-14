# Constraint System Testing Framework

This directory contains a comprehensive testing framework for the geometric constraint system. The framework provides multiple levels of testing from unit tests to end-to-end workflows.

## 📁 Test Structure

```
tests/
├── constraintSystem.test.js      # Unit tests for constraint system bindings
├── constraintService.test.js     # Integration tests for service layer
├── ConstraintTool.test.jsx       # React component tests
├── testRunner.js                 # Test orchestration and runner
└── README.md                     # This documentation
```

## 🧪 Test Categories

### 1. Unit Tests (`constraintSystem.test.js`)

Tests the core constraint system bindings directly:
- **Initialization**: System startup and configuration
- **Entity Management**: CRUD operations for geometric entities
- **Constraint Management**: CRUD operations for constraints
- **Constraint Solver**: Solving algorithms and convergence
- **System Validation**: Data integrity and validation
- **Performance**: Load testing and optimization
- **Event System**: Real-time event handling
- **Memory Management**: Resource cleanup and leak prevention

### 2. Integration Tests (`constraintService.test.js`)

Tests the service layer that bridges the constraint system with the UI:
- **Service Initialization**: Service startup and connection
- **Entity API**: RESTful-style entity operations
- **Constraint API**: RESTful-style constraint operations
- **Solver Integration**: Service-level solving operations
- **System Management**: High-level system operations
- **Import/Export**: Data persistence and transfer
- **Event Subscription**: Real-time update handling
- **Error Handling**: Error recovery and graceful degradation
- **Performance**: Service-level performance testing

### 3. Component Tests (`ConstraintTool.test.jsx`)

Tests React UI components using React Testing Library:
- **Rendering**: Component display and conditional rendering
- **Mode Switching**: UI mode transitions and state management
- **Constraint Type Selection**: User interaction and validation
- **Entity Selection**: Entity management and display
- **Form Validation**: Input validation and error display
- **Constraint Creation**: User workflow and data handling
- **Constraint Management**: List display and manipulation
- **Theme Support**: Dark/light theme compatibility
- **Accessibility**: ARIA labels, keyboard navigation, screen readers
- **Loading States**: Async operation feedback

### 4. End-to-End Tests (`E2ETestSuite`)

Tests complete user workflows:
- **Create and Solve Distance Constraint**: Full workflow from creation to solving
- **Create Parallel Constraints**: Multi-constraint workflows
- **Complex Constraint System**: Large-scale system testing
- **Import/Export Workflow**: Data persistence workflows
- **Error Recovery**: System resilience testing

## 🚀 Running Tests

### Development Mode

```javascript
import { runTestsInBrowser } from './tests/testRunner.js';

// Run all tests with development configuration
runTestsInBrowser().then(results => {
  console.log('Test results:', results);
});
```

### Programmatic Usage

```javascript
import { runConstraintSystemTests, testConfigs } from './tests/testRunner.js';

// Run with specific configuration
const results = await runConstraintSystemTests(testConfigs.thorough);

// Run with custom configuration
const customResults = await runConstraintSystemTests({
  timeout: 15000,
  retries: 2,
  verbose: true,
  bail: false
});
```

### Individual Test Suites

```javascript
import { 
  ConstraintSystemTestSuite,
  ConstraintServiceTestSuite,
  ComponentTestSuite 
} from './tests/testRunner.js';

// Run specific test suite
const constraintTests = new ConstraintSystemTestSuite();
const results = await constraintTests.run();
```

## ⚙️ Configuration Options

### Test Runner Configuration

```javascript
const config = {
  timeout: 10000,      // Test timeout in milliseconds
  retries: 2,          // Number of retries for failed tests
  verbose: true,       // Detailed output
  bail: false,         // Stop on first failure
  concurrent: false    // Run tests concurrently (future feature)
};
```

### Preset Configurations

- **`development`**: Balanced settings for development
- **`ci`**: Optimized for continuous integration
- **`quick`**: Fast execution for rapid feedback
- **`thorough`**: Comprehensive testing with retries

## 📊 Test Output

### Console Output Format

```
🧪 Starting Constraint System Test Runner
Running 4 test suites...

📁 Running suite: Constraint System Bindings
    ✓ Initialization tests passed
    ✓ Entity management tests passed
    ✓ Constraint management tests passed
    ✓ Constraint solver tests passed
    ✓ System validation tests passed
    ✓ Performance tests passed
    ✓ Event system tests passed
    ✓ Memory management tests passed
  ✅ Constraint System Bindings: 8/8 tests passed

📁 Running suite: Constraint Service Integration
    ✓ Service initialization tests passed
    ✓ Entity API tests passed
    ✓ Constraint API tests passed
    ✓ Solver integration tests passed
    ✓ System management tests passed
    ✓ Import/export tests passed
    ✓ Event subscription tests passed
    ✓ Error handling tests passed
    ✓ Performance tests passed
  ✅ Constraint Service Integration: 9/9 tests passed

📊 Test Summary
══════════════════════════════════════════════════
Total Tests: 35
✅ Passed: 35
❌ Failed: 0
⏭️  Skipped: 0
⏱️  Duration: 1250ms

📈 Success Rate: 100.0%

🎉 All tests passed!
```

### Results Object

```javascript
{
  passed: 35,
  failed: 0,
  skipped: 0,
  total: 35,
  startTime: 1640995200000,
  endTime: 1640995201250,
  duration: 1250,
  errors: []
}
```

## 🔧 Writing New Tests

### Adding Unit Tests

```javascript
// In constraintSystem.test.js
describe('New Feature', () => {
  test('should perform new operation', async () => {
    const result = await constraintSystem.newOperation();
    expect(result).toBeDefined();
  });
});
```

### Adding Integration Tests

```javascript
// In constraintService.test.js
describe('New API Endpoint', () => {
  test('should handle new request', async () => {
    const response = await constraintService.newEndpoint();
    expect(response.success).toBe(true);
  });
});
```

### Adding Component Tests

```javascript
// In ComponentName.test.jsx
describe('New Component', () => {
  test('should render correctly', () => {
    render(<NewComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

## 🎯 Test Coverage Goals

### Coverage Targets
- **Unit Tests**: 90%+ code coverage
- **Integration Tests**: 85%+ API coverage
- **Component Tests**: 80%+ component coverage
- **E2E Tests**: 100% critical workflow coverage

### Key Test Areas
- ✅ **Core Algorithms**: Constraint solving, entity management
- ✅ **API Endpoints**: All service methods
- ✅ **User Interactions**: All UI workflows
- ✅ **Error Scenarios**: Edge cases and error recovery
- ✅ **Performance**: Load testing and optimization
- ✅ **Accessibility**: WCAG compliance
- ✅ **Browser Compatibility**: Cross-browser testing

## 🐛 Debugging Tests

### Common Issues

1. **Timeout Errors**
   ```javascript
   // Increase timeout for slow operations
   const config = { timeout: 30000 };
   ```

2. **Async Test Issues**
   ```javascript
   // Ensure proper async/await usage
   test('async operation', async () => {
     await expect(asyncOperation()).resolves.toBe(expected);
   });
   ```

3. **Component Test Failures**
   ```javascript
   // Use waitFor for async UI updates
   await waitFor(() => {
     expect(screen.getByText('Updated Text')).toBeInTheDocument();
   });
   ```

### Debug Mode

```javascript
// Enable verbose logging
const results = await runConstraintSystemTests({
  verbose: true,
  bail: false // Continue running to see all failures
});
```

## 📈 Performance Testing

### Benchmarks

The testing framework includes performance benchmarks:

- **Entity Creation**: < 10ms per entity
- **Constraint Creation**: < 20ms per constraint
- **Constraint Solving**: < 500ms for complex systems
- **UI Rendering**: < 100ms for component updates
- **Memory Usage**: Stable with proper cleanup

### Load Testing

```javascript
// Test with large datasets
const loadTest = async () => {
  const entityCount = 1000;
  const constraintCount = 500;
  
  const startTime = performance.now();
  // ... create entities and constraints ...
  const endTime = performance.now();
  
  expect(endTime - startTime).toBeLessThan(5000); // 5 second limit
};
```

## 🔄 Continuous Integration

### CI Configuration

```yaml
# Example GitHub Actions configuration
name: Constraint System Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test -- --config=ci
```

### Pre-commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:quick"
    }
  }
}
```

## 📝 Test Maintenance

### Regular Maintenance Tasks

1. **Update Test Data**: Keep test fixtures current
2. **Review Coverage**: Ensure new features are tested
3. **Performance Monitoring**: Track test execution times
4. **Dependencies**: Keep testing libraries updated
5. **Documentation**: Update test documentation

### Best Practices

- ✅ Write tests before implementing features (TDD)
- ✅ Keep tests focused and atomic
- ✅ Use descriptive test names
- ✅ Mock external dependencies
- ✅ Clean up test resources
- ✅ Test both happy and error paths
- ✅ Include performance assertions
- ✅ Maintain test documentation

## 🆘 Troubleshooting

### Common Test Failures

1. **Memory Leaks**
   - Ensure proper cleanup in afterEach hooks
   - Check event listener unsubscription

2. **Race Conditions**
   - Use proper async/await patterns
   - Add appropriate wait conditions

3. **Browser Compatibility**
   - Test in multiple browsers
   - Use appropriate polyfills

4. **Performance Degradation**
   - Monitor test execution times
   - Profile constraint solving performance

### Getting Help

- Check console output for detailed error messages
- Enable verbose mode for additional debugging info
- Review test documentation and examples
- Check browser developer tools for runtime errors

---

This testing framework ensures the reliability, performance, and maintainability of the constraint system. Regular execution of these tests helps catch regressions early and maintains code quality throughout development. 