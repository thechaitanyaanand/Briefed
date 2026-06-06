# Contributing to Briefed

First off, thank you for taking the time to contribute! Contributions are what make the open-source community an amazing place to learn, inspire, and create.

All kinds of contributions are welcome: bug reports, feature requests, documentation improvements, and code changes!

---

## 🛠️ Local Development Setup

Briefed is built with Node.js and TypeScript, using Vitest for tests.

### 1. Prerequisites
Make sure you have Node.js (version 18 or higher) and npm installed.

### 2. Fork and Clone
1. Fork the [Briefed repository](https://github.com/thechaitanyaanand/Briefed).
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/Briefed.git
   cd Briefed
   ```

### 3. Install Dependencies
```bash
npm install
```

### 4. Build Code
To compile TypeScript to JavaScript:
```bash
npm run build
```
Or start the compiler in watch mode during development:
```bash
npm run dev
```

### 5. Running Tests
We use Vitest. To run the test suite:
```bash
npm run test
```

---

## 🧪 Coding Guidelines

- **TypeScript**: All core logic must be typed. Avoid `any` where possible.
- **Tests**: If you add new functionality, please add corresponding tests under `src/__tests__/`.
- **Zero Dependencies**: Keep the package lightweight. Do not add external dependencies unless absolutely necessary and approved in an issue first.
- **Hooks Line Endings**: Keep Windows users in mind. Ensure hook scripts (`scripts/post-merge` and `scripts/post-rewrite`) are saved with LF line endings.

---

## 🚀 Pull Request Checklist

Before submitting a pull request, please make sure:
1. All unit tests pass (`npm run test`).
2. Code compiles cleanly (`npm run build`).
3. You've described your changes in the PR description using the template.
4. Your commit message follows a clean format (e.g. `feat: add Ollama local models` or `fix: restore workspace boundary checks`).
