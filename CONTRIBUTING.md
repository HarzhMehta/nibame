# Contributing to nibame

Thanks for your interest in contributing to **nibame**.

nibame is an open-source project exploring the idea of a personal second brain. There are many parts of the project that need thought, experimentation, implementation, documentation, and review.

You do not need to be an expert in everything. If you have something useful to contribute, we'd love to have it.

## Ways You Can Contribute

There is no single type of contribution expected from contributors.

You can help with:

* **Documentation**

  * Project documentation
  * Technical documentation
  * Guides and examples
  * Architecture documentation
  * Improving clarity and readability

* **System Design**

  * Architecture
  * Data modeling
  * Graph design
  * Sys design ideas
  * Storage and retrieval architecture
  * Scalability and reliability

* **Algorithms and Intelligence**

  * Search and retrieval
  * Graph algorithms
  * Ranking and recommendation
  * Information extraction
  * Classification
  * AI and LLM pipelines
  * Memory and context systems

* **Backend**

  * APIs
  * Database systems
  * Authentication
  * Integrations
  * Background jobs
  * Core application logic

* **Web / App Development**

  * Frontend
  * UI/UX
  * Feature Visualization
  * Responsive design
  * Accessibility
  * Performance

* **Testing and Reliability**

  * Unit tests
  * Integration tests
  * End-to-end tests
  * Bug reports
  * Performance testing
  * Security improvements

* **Ideas and Research**

  * New use cases
  * Technical experiments
  * Design proposals
  * Research
  * Exploring better approaches

If you see something that can be improved, that is a contribution too.

---

My personal note (Harsh) : Please never use stetements like "My codex suggested me x" or "Oh i guess my claude didnt do this, let me do this again". Please take accountability in your submission as i have such frends who follow the mentioned statements and its really annoying.

---

## Before You Start

To contribute to nibame, start by forking the repository to your own GitHub account. Clone your fork locally, create a new branch for your changes, and make your modifications there. Once your work is ready, push the branch to your fork and open a Pull Request (PR) against the main nibame repository. Keep your fork and local repository up to date with the upstream repository to avoid unnecessary merge conflicts.

```bash
git clone https://github.com/<your-username>/nibame.git
cd nibame

git remote add upstream https://github.com/<original-owner>/nibame.git

git checkout -b feature/your-feature-name

# make your changes

git add .
git commit -m "feat: describe your change"
git push origin feature/your-feature-name
```

For larger changes, especially architectural or foundational changes, it is a good idea to open an issue or discussion first.

This helps us:

1. Understand the problem.
2. Discuss possible approaches.
3. Avoid duplicate work.
4. Keep the overall architecture consistent.

For small fixes, documentation changes, bug fixes, and similar contributions, feel free to open a pull request directly.

---

## Pull Requests

A good pull request should:

* Clearly explain what was changed.
* Explain why the change was needed.
* Keep the scope focused where possible.
* Include tests when appropriate.
* Update relevant documentation when necessary.
* Avoid unrelated changes.

Before submitting, make sure your changes work locally and that existing tests continue to pass.

---

## Code and Design

There is no expectation that every contribution must follow an existing implementation perfectly.

nibame is still evolving, so experimentation is encouraged.

For larger changes, focus on:

* Simplicity
* Maintainability
* Clear abstractions
* Good separation of concerns
* Privacy
* Security
* Performance
* Long-term extensibility

If you disagree with an existing approach, propose a better one. Technical discussion is encouraged.

---

## Using AI

AI tools are welcome when contributing to nibame.

You may use ai tools or agents.

However, there is one principle that matters:

> **You are responsible and accountable for your submission.**

If you submit code, documentation, an architecture proposal, an algorithm, or any other contribution, **you own the responsibility for understanding and standing behind what you submit, regardless of whether it was written with the help of AI.**

AI assistance does not transfer responsibility to the tool, the project maintainers, or anyone else.

Before opening a pull request, you should be able to:

* Explain what your contribution does.
* Explain why you made the relevant technical choices.
* Verify that it works as intended.
* Identify important limitations or trade-offs.
* Fix issues that arise from your contribution.

There is no requirement to disclose which AI tools you used unless a specific contribution requires it.

The standard is simple:

```text
AI can help you create it.

You are responsible for what you submit.
```

---

## Commit Messages

Keep commit messages clear and meaningful.

For example:

```text
feat: add graph-based bookmark retrieval
fix: handle duplicate link ingestion
docs: improve architecture overview
refactor: simplify memory extraction pipeline
test: add ingestion integration tests
```

There is no need to overcomplicate commit messages. They should make it reasonably clear what changed.

---

## Issues and Discussions

When opening an issue, try to provide enough context for someone else to understand the problem.

For bug reports, include:

* What happened
* What you expected
* Steps to reproduce
* Relevant logs or screenshots
* Environment information when useful

For feature requests or architectural ideas, explain:

* The problem you are trying to solve
* Why it matters
* Your proposed approach, if you have one
* Alternatives you considered

---

## Keep the Project Human

nibame is ultimately about building something that helps people manage the context of their lives.

Contributions should therefore favor:

* Simple interfaces
* Useful abstractions
* Clear documentation
* Respect for user privacy
* User ownership of data
* Practical solutions over unnecessary complexity

Do not add complexity simply because the technology is interesting.

---

## Getting Started

If you're new to the project, a good place to start is:

1. Read the project README.
2. Understand the current architecture.
3. Look through open issues.
4. Find an area that interests you.
5. Start small.
6. Ask questions when something is unclear.

You do not need to understand the entire project before making your first contribution.

---

## Thank You

Every contribution helps, whether it is a small documentation fix, a bug report, an architectural idea, an algorithm, a UI improvement, or a major feature.

**Thanks for helping build nibame.**
