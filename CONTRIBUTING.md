# Contributing to ShadSheet

Thank you for your interest in contributing to ShadSheet! This document provides guidelines and instructions for contributing.

## Prerequisites

- Node.js 20+
- npm 10+

## Development Setup

```bash
# Clone the repository
git clone https://github.com/shadsheet/ui.git
cd ui

# Install dependencies
npm install

# Start development server
npm run dev

# Run Storybook for component development
npm run storybook
```

## Code Standards

### TypeScript

- Strict mode enabled
- Prefer explicit types over `any`
- Use named exports for better tree-shaking

### Styling

- Tailwind CSS v4 with CSS-first configuration
- Follow shadcn/ui conventions for component styling
- Use `cn()` utility for conditional class merging

### Component Conventions

- Components are in `src/components/`
- Hooks are in `src/hooks/`
- Utilities are in `src/utils/`
- Types are in `src/types/`
- Zustand stores are in `src/stores/`

### File Naming

- Use kebab-case for file names: `my-component.tsx`
- Components use PascalCase for exports: `export function MyComponent()`

## Pull Request Process

1. **Fork and Branch**: Fork the repo, create a feature branch from `main`
2. **Make Changes**: Implement your feature or fix
3. **Test**: Ensure `npm run build` and `npm run lint` pass
4. **Commit**: Use conventional commit format
5. **Push and PR**: Push your branch and open a pull request

### Commit Message Format

We use conventional commits:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions/changes
- `chore:` - Build process, dependencies, etc.

Example: `feat: add cell merge undo/redo support`

### PR Guidelines

- Keep PRs focused on a single feature or fix
- Add tests for new functionality (when test infrastructure is ready)
- Update documentation for API changes
- Link related issues

## NPM Organization Setup

Before publishing, the `@shadsheet` npm organization must be created:

```bash
# Create npm organization (requires npmjs.com account)
npm org create shadsheet

# Or via npmjs.com → Organizations → Create
```

## Running Tests

```bash
# (Test runner configuration pending)
npm test
```

## Building

```bash
# Build for production
npm run build

# Verify package contents
npm pack --dry-run
```

## Questions?

Open an issue for bugs, feature requests, or questions. We welcome all contributions!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.