# Security Policy

## Supported versions

Security fixes are applied to the latest published `0.3.x` release.

## Reporting a vulnerability

Please do not disclose a vulnerability in a public issue, discussion, or pull request. Use GitHub's private vulnerability reporting flow from the repository's **Security** tab. If that flow is unavailable, contact the maintainer privately through the GitHub profile linked from this repository.

Include:

- affected version and DSH version;
- the request or event sequence needed to reproduce it;
- whether data can be read, modified, or written outside the intended directory;
- any suggested mitigation.

The plugin is intended to be read-only with respect to DSH conversation state. The optional step ledger may write to a configured path, so path handling and the stats HTTP route are security-sensitive areas.
