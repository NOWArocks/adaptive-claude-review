# Releasing

Use this checklist for every public release.

1. Confirm that `package.json`, `CHANGELOG.md`, and README installation commands use the same version.
2. Replace `unreleased` in `CHANGELOG.md` with the release date.
3. Run `bun install --frozen-lockfile` and `bun run verify`.
4. Run a static secret scan and inspect the package file list from `npm pack --dry-run --json`.
5. Commit and push the release state while the repository is still private.
6. Confirm that the GitHub Actions `Verify` workflow passes for the release commit.
7. Create and push the annotated release tag. Then create the GitHub Release for that tag with the changelog section as its notes and mark it as the latest release: `gh release create vX.Y.Z --verify-tag --latest --title vX.Y.Z --notes-file <changelog-section>`. The repository sidebar shows Releases, not tags.
8. Change the repository to public only after explicit approval from the owner.
9. As the first action after the visibility change, enable GitHub private vulnerability reporting and verify the setting through the GitHub API.
10. Confirm from a logged-out or non-member view that the reporting link in `SECURITY.md` is available.
11. With an isolated temporary home directory, run the exact tagged `pi install` command from README. Confirm that `claude-review-status` appears in the RPC command list.
12. Download the tagged example configuration from its documented raw GitHub URL. Confirm that it starts with `enabled` set to `false` and does not overwrite an existing configuration.
13. Confirm the repository visibility and the release tag, then announce the release.

Do not move an existing release tag. Fix a released defect in a new version.
