# Institution OS Invariants

Status: architectural guardrails

These invariants are the non-negotiable rules that future implementation work must preserve unless they are explicitly amended through institutional governance.

They exist to keep Institution OS from becoming a collection of convenient scripts that accidentally bypass the institution they are supposed to serve.

## Core identity invariants

1. Institution OS is not The Citizen Audit.

2. The Citizen Audit is the reference institution running on Institution OS.

3. Platform surfaces do not create institutional authority.

4. Software serves the institution. The institution does not exist to justify software behavior.

## Doctrine invariants

5. Doctrine is authoritative over implementation.

6. Doctrine must remain human-readable.

7. Software may interpret doctrine but may not silently rewrite doctrine.

8. Doctrine changes require explicit governance.

## Registry invariants

9. The Institution Registry is canonical for institutional object identity.

10. Nothing important exists only because a folder exists.

11. Boot manifests may order phases but may not create object identity.

12. Registry objects must be explicit. They must not be generated silently at runtime.

## Dependency invariants

13. Institutional dependencies belong to canonical registry objects through `dependsOn`.

14. Boot order is not dependency order.

15. Dependency graph validation must be deterministic.

16. Impact analysis must be based on registered objects and declared dependencies, not guesses.

## Authority invariants

17. Authority must be explicit.

18. Authority must be re-checked at execution time.

19. Prior approval is evidence of a prior decision, not permanent authorization.

20. Human-review-required actions may not execute automatically.

21. AI does not possess institutional authority by default.

## Transaction invariants

22. Transactions are governed institutional operation records.

23. Transactions record intent before mutation.

24. Transactions v1 do not directly mutate canonical state.

25. Transactions are the execution unit.

26. Proposed writes are descriptive until applied by the Execution Engine.

## Execution invariants

27. Execution may apply only approved transactions.

28. Execution may not invent writes.

29. Execution may not broaden transaction scope.

30. Execution must reject prohibited paths.

31. Execution must be logged.

32. Execution must be rollback-safe within its declared scope.

33. Execution must not mutate doctrine or audit truth records unless future governance explicitly authorizes that scope.

34. Execution should validate institutional state after mutation before committing success.

## Event invariants

35. Console output is not the primary institutional record.

36. Important operations emit structured events.

37. Events must support review, debugging, and eventual replay.

38. Important events should be append-only.

## Memory invariants

39. Memory records relationships and history.

40. Memory does not create conclusions.

41. Memory must preserve why institutional state changed, not merely that files changed.

## Truth invariants

42. AI may automate process. AI may never automate truth.

43. Evidence must remain separable from interpretation.

44. Published truth-bearing records may only be corrected or superseded through governed process.

45. Source verification status may not be fabricated to satisfy release pressure.

46. Unknowns may not be erased to create the appearance of completeness.

## Health and state invariants

47. Health reporting must not repair the institution by itself.

48. Institution state must be explicit, not inferred from scattered logs.

49. Scheduler and Execution must obey institution state once state exists.

## Workforce invariants

50. Agents must be narrow, inspectable, constrained, logged, and replaceable.

51. Agents may recommend. Humans approve high-authority institutional change.

52. Departments coordinate labor. They do not create truth.

## Compatibility invariants

53. Legacy compatibility may remain during migration.

54. Deprecated sources must be clearly labeled.

55. If a deprecated source is used, the system should emit a structured warning event.

56. Compatibility must not be confused with authority.

## Governing invariant

57. Every important conclusion must remain independently verifiable.

58. Every important operation must leave a record.

59. Every important mutation must be governed.

60. The founder is not exempt from institutional process.
