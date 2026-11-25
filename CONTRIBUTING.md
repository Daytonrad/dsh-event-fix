# Contributing to dsh-event-fix

Thanks for taking the time to improve the project. Small, focused contributions are preferred over large rewrites.

## Good first contributions

- Reproduce a bug with a minimal session fixture and add a failing test.
- Improve the Chinese or English documentation with a real installation trace.
- Add a missing edge case to the error taxonomy.
- Add a CLI validation test for invalid arguments or paths.
- Improve accessibility or keyboard behavior in the settings page.

Look for issues labelled [`good first issue`](https://github.com/SSHOOTING/dsh-event-fix/labels/good%20first%20issue).

## Development setup

```powershell
git clone https://github.com/SSHOOTING/dsh-event-fix.git
cd dsh-event-fix
npm ci
npm test
npm run check
```

The test suite uses Node's built-in test runner. No global DSH installation is needed for unit tests.

## Pull request flow

1. Fork the repository and create a branch from `main`.
2. Keep one concern per pull request.
3. Add or update a test for behavior changes.
4. Run `npm test` and `npm run check`.
5. Update the README or CHANGELOG when a user-visible behavior changes.
6. Open the pull request and describe the problem, the change, and the verification you ran.

## Data and privacy

Do not commit real DSH session logs, credentials, tokens, or machine-specific absolute paths. Tests should use small synthetic fixtures. If a bug needs a real event shape, reduce it to the smallest possible JSON/JSONL example and remove identifying content.

## Compatibility

The plugin currently targets DSH `>=0.2.0-rc.2 <0.2.1` and Node.js `^22.19.0 || >=24.0.0`. If you change event parsing, add a fixture that demonstrates the new shape and explain whether it is backwards compatible.

## Reporting security issues

Please do not open a public issue for a vulnerability. Use the repository's **Security → Report a vulnerability** flow when available, or contact the maintainer privately through the GitHub profile linked from the repository.
