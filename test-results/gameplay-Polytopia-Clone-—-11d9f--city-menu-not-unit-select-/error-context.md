# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: gameplay.spec.ts >> Polytopia Clone — Gameplay E2E >> clicking city on tile with unit opens city menu (not unit select)
- Location: tests-e2e/gameplay.spec.ts:236:3

# Error details

```
Error: page.evaluate: TypeError: Cannot read properties of undefined (reading 'constructor')
    at eval (eval at evaluate (:302:30), <anonymous>:6:32)
    at UtilityScript.evaluate (<anonymous>:304:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
```