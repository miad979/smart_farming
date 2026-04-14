# Contributing to Smart Farming Management System

First off, thank you for considering contributing to Smart Farming! It's people like you that make this system better for farmers across Bangladesh. 🌾

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [Translation Guidelines](#translation-guidelines)
- [Bug Reports](#bug-reports)
- [Feature Requests](#feature-requests)
- [Documentation](#documentation)
- [Community](#community)

---

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to conduct@smartfarming.bd.

---

## How Can I Contribute?

### 🐛 Reporting Bugs

Before creating bug reports, please check the [existing issues](https://github.com/your-org/smart-farming/issues) as you might find that the problem has already been reported.

**When submitting a bug report, include:**

- **Clear title** - Descriptive summary of the issue
- **Steps to reproduce** - Detailed steps to recreate the bug
- **Expected behavior** - What you expected to happen
- **Actual behavior** - What actually happened
- **Screenshots** - If applicable
- **Environment details**:
  - Browser (Chrome, Firefox, Safari, etc.)
  - Device (Desktop, Mobile)
  - Operating System
  - App version

**Bug Report Template:**

```markdown
## Bug Description
A clear description of the bug

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Screenshots
If applicable

## Environment
- Browser: Chrome 120
- Device: Samsung Galaxy S21
- OS: Android 13
- Version: 1.0.0

## Additional Context
Any other relevant information
```

### ✨ Suggesting Features

We love feature suggestions! Before creating a feature request:

1. Check if the feature has already been suggested
2. Ensure it aligns with project goals (helping Bangladeshi farmers)
3. Consider if it's a common need vs. edge case

**Feature Request Template:**

```markdown
## Feature Description
Clear description of the proposed feature

## Problem It Solves
What problem does this feature address?

## Proposed Solution
How should this feature work?

## Alternatives Considered
Other solutions you've thought about

## User Stories
- As a farmer, I want to...
- As a doctor, I need to...

## Implementation Notes
Technical considerations (optional)

## Screenshots/Mockups
Visual representations (optional)
```

### 🔧 Contributing Code

1. **Fork the repository**
2. **Create a feature branch** from `develop`
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Test thoroughly**
5. **Commit with clear messages**
6. **Push to your fork**
7. **Open a Pull Request**

---

## Development Setup

### Prerequisites

- Node.js 18+
- npm or pnpm
- Git
- Code editor (VS Code recommended)

### Setup Instructions

```bash
# 1. Fork and clone
git clone https://github.com/your-username/smart-farming.git
cd smart-farming

# 2. Add upstream remote
git remote add upstream https://github.com/original-org/smart-farming.git

# 3. Install dependencies
npm install

# 4. Start development server
npm run dev

# 5. Open browser
# Navigate to http://localhost:5173
```

### Project Structure

```
smart-farming/
├── src/app/          # Application code
├── src/styles/       # Global styles
├── docs/             # Documentation
├── public/           # Static assets
└── tests/            # Test files
```

---

## Coding Standards

### TypeScript

**✅ Do:**

```typescript
// Use TypeScript types
interface FarmerData {
  id: string;
  name: string;
  crops: string[];
}

// Use functional components
export const MyComponent: React.FC<Props> = ({ data }) => {
  return <div>{data}</div>;
};

// Use const for immutable values
const API_URL = 'https://api.smartfarming.bd';

// Use descriptive names
const getUserCropLogs = async (userId: string) => {
  // implementation
};
```

**❌ Don't:**

```typescript
// Don't use any
const data: any = getData(); // ❌

// Don't use var
var count = 0; // ❌ Use const or let

// Don't use generic names
const getData = () => {}; // ❌ Too generic
const data = {}; // ❌ What kind of data?
```

### React Best Practices

**✅ Do:**

```typescript
// Use hooks
const [state, setState] = useState(initialValue);
const value = useMemo(() => expensive(data), [data]);
const callback = useCallback(() => {}, [deps]);

// Use Context for global state
const { state } = useApp();

// Clean up effects
useEffect(() => {
  const subscription = subscribe();
  return () => subscription.unsubscribe();
}, []);

// Memoize expensive components
export const ExpensiveComponent = memo(({ data }) => {
  // render
});
```

**❌ Don't:**

```typescript
// Don't call hooks conditionally
if (condition) {
  useState(value); // ❌
}

// Don't forget dependencies
useEffect(() => {
  doSomething(prop);
}, []); // ❌ Missing prop dependency

// Don't mutate state directly
state.value = newValue; // ❌
setState(newValue); // ✅
```

### Tailwind CSS

**✅ Do:**

```tsx
// Use semantic class combinations
<div className="rounded-xl shadow-md p-5 border-2 border-gray-100">

// Use responsive classes
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">

// Use consistent spacing
<div className="space-y-6">
```

**❌ Don't:**

```tsx
// Don't use arbitrary values unnecessarily
<div className="p-[17px]"> {/* ❌ Use standard spacing */}

// Don't mix inline styles with Tailwind
<div className="p-4" style={{ padding: '20px' }}> {/* ❌ Conflicting */}
```

### File Naming

- **Components:** PascalCase - `DiseaseDetection.tsx`
- **Utilities:** camelCase - `translations.ts`
- **Hooks:** camelCase with 'use' prefix - `useOnlineStatus.ts`
- **Types:** PascalCase - `UserTypes.ts`
- **Constants:** UPPER_SNAKE_CASE in file - `API_CONFIG.ts`

### Code Organization

```typescript
// Order of imports
import React from 'react'; // 1. React
import { useState } from 'react'; // 2. React hooks
import { useApp } from '../context/AppContext'; // 3. Internal hooks
import { t } from '../utils/translations'; // 4. Utilities
import { Button } from './components/Button'; // 5. Components
import { Camera } from 'lucide-react'; // 6. External libraries
import './styles.css'; // 7. Styles

// Order of component code
export const MyComponent: React.FC<Props> = (props) => {
  // 1. Hooks
  const { state } = useApp();
  const [localState, setLocalState] = useState();
  
  // 2. Derived state
  const lang = state.language;
  
  // 3. Effects
  useEffect(() => {}, []);
  
  // 4. Event handlers
  const handleClick = () => {};
  
  // 5. Render helpers
  const renderHeader = () => {};
  
  // 6. Return JSX
  return <div>...</div>;
};
```

### Translation Guidelines

**Always provide both Bengali and English:**

```typescript
// ✅ Correct
export const translations = {
  welcome: {
    bn: 'স্বাগতম',
    en: 'Welcome',
  },
};

// ❌ Incorrect
export const translations = {
  welcome: 'Welcome', // Missing Bengali
};
```

**Use translation function in components:**

```typescript
// ✅ Correct
import { t } from '../utils/translations';
const lang = state.language;
<h1>{t('welcome', lang)}</h1>

// ❌ Incorrect
<h1>Welcome</h1> // Hardcoded English
```

### Accessibility

**✅ Do:**

```tsx
// Use semantic HTML
<button onClick={handleClick}>Click me</button>

// Add ARIA labels
<button aria-label="Close dialog" onClick={close}>
  <X />
</button>

// Use alt text
<img src="crop.jpg" alt="Diseased rice leaf" />

// Support keyboard navigation
<div role="button" tabIndex={0} onKeyDown={handleKeyDown}>
```

**❌ Don't:**

```tsx
// Don't use div for buttons
<div onClick={handleClick}>Click me</div> // ❌

// Don't forget alt text
<img src="crop.jpg" /> // ❌

// Don't create keyboard traps
// Make sure tab navigation works properly
```

### Performance

**✅ Do:**

```typescript
// Memoize expensive calculations
const expensiveValue = useMemo(() => {
  return calculateExpensiveValue(data);
}, [data]);

// Lazy load routes
const DiseaseDetection = lazy(() => import('./pages/DiseaseDetection'));

// Debounce search inputs
const debouncedSearch = debounce(handleSearch, 300);
```

**❌ Don't:**

```typescript
// Don't create objects/arrays in render
<Component data={{ value: 1 }} /> // ❌ Creates new object every render

// Don't perform expensive operations in render
const result = expensiveCalculation(data); // ❌ Runs every render
```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows the style guidelines
- [ ] Self-review of code
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Translations added (Bengali + English)
- [ ] Tests pass (when applicable)
- [ ] No console.log statements
- [ ] Tested on mobile and desktop
- [ ] Works in Bengali and English

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to break)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Related Issues
Closes #123
Related to #456

## Testing
- [ ] Tested in mobile view (Chrome DevTools)
- [ ] Tested in desktop view
- [ ] Tested Bengali translation
- [ ] Tested English translation
- [ ] Tested as Guest user
- [ ] Tested as Farmer
- [ ] Tested as Doctor
- [ ] Tested as Admin

## Screenshots
(If applicable)
Before: [screenshot]
After: [screenshot]

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where needed
- [ ] I have updated the documentation
- [ ] I have added translations (bn + en)
- [ ] My changes generate no new warnings
- [ ] I have tested on multiple browsers
- [ ] I have checked for accessibility issues

## Additional Notes
Any additional information
```

### Review Process

1. **Automated checks** run (linting, type checking)
2. **Code review** by maintainers
3. **Feedback** addressed
4. **Approval** from 1-2 reviewers
5. **Merge** to develop branch

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
type(scope): brief description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**

```bash
feat(disease): add PDF export functionality

fix(irrigation): toggle not persisting state

docs(api): update endpoint documentation

style(dashboard): improve card spacing

refactor(auth): simplify OTP logic

perf(charts): optimize rendering performance

test(disease): add unit tests for detection service

chore(deps): update dependencies
```

---

## Development Workflow

### Branch Strategy

```
main (production)
  ↓
develop (integration)
  ↓
feature/feature-name (your work)
```

### Working on a Feature

```bash
# 1. Update develop branch
git checkout develop
git pull upstream develop

# 2. Create feature branch
git checkout -b feature/my-feature

# 3. Make changes
# ... code, code, code ...

# 4. Commit changes
git add .
git commit -m "feat(scope): description"

# 5. Push to your fork
git push origin feature/my-feature

# 6. Create Pull Request on GitHub
# Target: develop branch
```

### Keeping Your Fork Updated

```bash
# Fetch upstream changes
git fetch upstream

# Merge into your develop
git checkout develop
git merge upstream/develop

# Push to your fork
git push origin develop
```

---

## Testing Guidelines

### Manual Testing

**Before submitting PR:**

1. **Browser testing**
   - Chrome (latest)
   - Firefox (latest)
   - Safari (latest)
   - Edge (latest)

2. **Device testing**
   - Mobile (320px width)
   - Tablet (768px width)
   - Desktop (1280px+ width)

3. **Feature testing**
   - Test all affected features
   - Test edge cases
   - Test error states
   - Test loading states

4. **Role testing**
   - Guest mode
   - Farmer (logged in)
   - Doctor (verified & unverified)
   - Admin

5. **Language testing**
   - Bengali language
   - English language

### Writing Tests (Future)

```typescript
// Example unit test
describe('DiseaseService', () => {
  it('should detect disease from image', async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const result = await diseaseService.detectDisease(file, 'user_123');
    
    expect(result).toBeDefined();
    expect(result.disease).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });
});
```

---

## Documentation Contributions

### Improving Docs

Documentation is just as important as code!

**Areas to contribute:**
- Fix typos and grammatical errors
- Improve clarity and examples
- Add missing information
- Update outdated content
- Add Bengali translations
- Create tutorials and guides

**Documentation files:**
- `/docs/SYSTEM_OVERVIEW.md`
- `/docs/COMPONENTS.md`
- `/docs/DATA_MODELS.md`
- `/docs/USER_GUIDE.md`
- `/docs/DEVELOPMENT.md`
- `/docs/API_INTEGRATION.md`
- `/docs/DEPLOYMENT.md`

### Documentation Standards

- Use clear, simple language
- Provide code examples
- Include both Bengali and English where applicable
- Keep formatting consistent
- Update table of contents
- Add cross-references

---

## Getting Help

### Resources

- 📚 [Documentation](/docs)
- 💬 [GitHub Discussions](https://github.com/your-org/smart-farming/discussions)
- 🐛 [Issue Tracker](https://github.com/your-org/smart-farming/issues)

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and ideas
- **Email**: dev@smartfarming.bd (for sensitive matters)

### First-Time Contributors

Look for issues labeled `good first issue` or `help wanted`:

- [Good First Issues](https://github.com/your-org/smart-farming/labels/good%20first%20issue)
- [Help Wanted](https://github.com/your-org/smart-farming/labels/help%20wanted)

---

## Recognition

Contributors will be recognized in:

- [CHANGELOG.md](CHANGELOG.md) for each release
- [README.md](README.md) contributors section
- GitHub contributors page
- Annual contributor highlights

---

## License

By contributing, you agree that your contributions will be licensed under the same [MIT License](LICENSE) that covers the project.

---

## Questions?

Don't hesitate to ask! We're here to help:

- Open a [GitHub Discussion](https://github.com/your-org/smart-farming/discussions)
- Email: contribute@smartfarming.bd
- Check existing [Issues](https://github.com/your-org/smart-farming/issues)

---

## Thank You! 🙏

Your contributions help make farming smarter and easier for farmers across Bangladesh. Every bug fix, feature, and documentation improvement makes a real difference!

**Happy Contributing!** 🌾

---

**Last Updated:** February 2026  
**Maintained by:** Smart Farming Team
