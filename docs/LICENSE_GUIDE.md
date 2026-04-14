# License Guide

## Overview

This guide explains the licensing structure of the Smart Farming Management System and how to comply with open-source licenses used in the project.

---

## Project License

### MIT License

The Smart Farming Management System is licensed under the **MIT License**, one of the most permissive open-source licenses.

**Location:** [/LICENSE](/LICENSE)

**What this means:**
- ✅ Free to use, modify, and distribute
- ✅ Commercial use allowed
- ✅ Private use allowed
- ✅ Modification allowed
- ✅ Distribution allowed
- ⚠️ Must include license and copyright notice
- ⚠️ No warranty provided

---

## License Files Structure

```
smart-farming/
├── LICENSE                         # Main MIT License (standard format)
├── NOTICE                          # Legal notices and disclaimers
├── ATTRIBUTIONS.md                 # Third-party component credits (protected)
└── THIRD_PARTY_LICENSES.md         # Full license texts of dependencies
```

### File Purposes

#### 1. LICENSE
**Standard MIT License**
- Minimal, legally-compliant format
- Standard MIT text with project copyright
- Must be included in all distributions
- No modifications or additions

#### 2. NOTICE
**Legal Notices and Disclaimers**
- Required notices per Apache 2.0 compliance
- Agricultural advice disclaimer
- Liability limitations
- Data protection requirements
- Bangladesh-specific considerations
- Third-party attributions summary

#### 3. ATTRIBUTIONS.md
**Protected File - Third-Party Credits**
- Quick reference for third-party components
- shadcn/ui attribution
- Unsplash image credits
- Maintained by platform (do not modify)

#### 4. THIRD_PARTY_LICENSES.md
**Complete License Texts**
- Full MIT License text with all copyright holders
- Full ISC License text (Lucide)
- Full Apache 2.0 License text (TypeScript, CVA)
- Unsplash License text
- License compatibility information

---

## Third-Party Licenses Used

### Summary Table

| License | Projects | Compatibility |
|---------|----------|---------------|
| MIT | React, React Router, Tailwind CSS, Recharts, Vite, shadcn/ui, Radix UI, and more | ✅ Fully compatible |
| ISC | Lucide React | ✅ MIT-compatible |
| Apache 2.0 | TypeScript, CVA | ✅ Compatible with MIT |
| Unsplash | Stock images | ✅ Free use license |

### License Compatibility

All licenses used are compatible with the MIT License:

```
MIT ← Compatible ← MIT
MIT ← Compatible ← ISC
MIT ← Compatible ← Apache 2.0
MIT ← Compatible ← Unsplash License
```

---

## Compliance Requirements

### For End Users

**Minimal requirements:**
1. Keep the LICENSE file if you redistribute
2. Maintain copyright notices
3. That's it! MIT is very permissive.

### For Commercial Use

**Allowed:**
- ✅ Use in commercial products
- ✅ Modify and sell
- ✅ Create proprietary derivatives
- ✅ Charge for services

**Required:**
1. Include LICENSE file
2. Include copyright notice
3. Include NOTICE file (for Apache 2.0 components)

**Optional but encouraged:**
- Give credit to the project
- Contribute improvements back
- Support the farming community

### For Redistributors

**You must include:**
1. `/LICENSE` - Main license file
2. `/NOTICE` - Legal notices
3. `/ATTRIBUTIONS.md` - Third-party credits
4. `/THIRD_PARTY_LICENSES.md` - Full license texts

**In your distribution:**
- Root directory or `/licenses` folder
- Accessible to end users
- Unmodified (exact copies)

### For Modifiers/Contributors

**When contributing code:**
- Code is automatically licensed under MIT
- No need to add license headers to files
- Copyright remains with contributors
- See [CONTRIBUTING.md](/CONTRIBUTING.md)

**When adding dependencies:**
1. Check license compatibility
2. Add to `THIRD_PARTY_LICENSES.md`
3. Update attribution lists
4. Verify with maintainers if unsure

---

## License Compatibility Guide

### ✅ Compatible Licenses (Safe to Add)

- MIT License
- ISC License
- BSD 2-Clause
- BSD 3-Clause
- Apache License 2.0
- CC0 (Public Domain)

### ⚠️ Restricted Licenses (Use with Caution)

- GPL 2.0/3.0 (Copyleft - may affect distribution)
- LGPL 2.1/3.0 (Weak copyleft - review carefully)
- MPL 2.0 (File-level copyleft)

### ❌ Incompatible Licenses (Do Not Use)

- Proprietary/Commercial licenses
- Non-commercial licenses (NC)
- Share-alike without MIT compatibility

**When in doubt:** Ask in GitHub Discussions or email legal@smartfarming.bd

---

## Special Considerations

### Agricultural Advice Disclaimer

**Important:** The NOTICE file contains crucial disclaimers about:

- **Not professional advice:** System assists but doesn't replace experts
- **No liability:** Not liable for crop failures or financial losses
- **Validation required:** AI results should be verified by professionals
- **Professional consultation:** Users should consult agricultural experts

**Why this matters:**
- Farming decisions affect livelihoods
- AI can make mistakes
- Local conditions vary
- Legal protection for developers

### Data Protection (GDPR/Local Laws)

**When deploying:**
- Comply with Bangladesh data protection laws
- Comply with GDPR if serving EU users
- Obtain user consent for data collection
- Implement proper security measures
- Provide clear privacy policy

See NOTICE file for full requirements.

### Bangladesh-Specific Use

**Considerations:**
- Respect local agricultural practices
- Ensure cultural appropriateness
- Support Bengali language properly
- Consider low-literacy users
- Support small-scale farmers

---

## Attribution Best Practices

### Minimal Attribution

**Required by license:**
```
Smart Farming Management System
Copyright (c) 2026 Smart Farming Management System Contributors
Licensed under the MIT License
```

### Recommended Attribution

**For websites/apps:**
```
Built with Smart Farming Management System
https://github.com/miad979/smart_farming
Licensed under MIT License
```

**For documentation:**
```
This project uses the Smart Farming Management System,
an open-source agricultural platform for Bangladeshi farmers.

Source: https://github.com/miad979/smart_farming
License: MIT License
```

### Crediting Third-Party Libraries

**In About/Credits section:**
```
This application uses the following open-source software:
- React (MIT License) - UI framework
- Tailwind CSS (MIT License) - Styling
- Recharts (MIT License) - Charts
- Lucide (ISC License) - Icons
- TypeScript (Apache 2.0) - Type safety

See THIRD_PARTY_LICENSES.md for complete license texts.
```

---

## FAQ

### Can I use this commercially?

**Yes!** The MIT License explicitly allows commercial use. You can:
- Sell products built with this software
- Charge for hosting/services
- Create proprietary derivatives
- Use in closed-source products

Just include the LICENSE and NOTICE files.

### Do I need to open-source my modifications?

**No.** Unlike GPL, MIT License does not require you to open-source your modifications. You can keep your changes private if you wish.

However, we encourage contributions back to the community!

### Can I remove the copyright notice?

**No.** The MIT License requires that you include the copyright notice and license text in all copies or substantial portions of the software.

### What about the Apache 2.0 components (TypeScript)?

**Include the NOTICE file.** Apache 2.0 requires that NOTICE files be included. Our NOTICE file covers this requirement.

### Can I change the license?

**Only for your modifications.** You can:
- Dual-license your modifications
- Add additional terms to your version
- Cannot remove MIT License from original code

### Do I need permission to use this?

**No.** The MIT License grants you automatic permission to use, modify, and distribute the software. No need to ask!

### What if I find a license violation?

**Contact us:**
- Email: legal@smartfarming.bd
- Open a GitHub issue with `[legal]` tag
- We'll work to resolve it

---

## Updating License Information

### When to Update

**Update license files when:**
- Adding new dependencies
- Removing dependencies
- Upgrading major versions
- Changing licenses of dependencies

### How to Update

1. **Add to THIRD_PARTY_LICENSES.md:**
   - Add full license text
   - Add copyright notice
   - Verify compatibility

2. **Update package.json:**
   - Ensure license field is correct
   - Add to dependencies

3. **Test compliance:**
   ```bash
   npm install -g license-checker
   license-checker --summary
   ```

4. **Review annually:**
   - Check for license changes
   - Verify compliance
   - Update documentation

---

## Resources

### License Information

- **MIT License:** https://opensource.org/licenses/MIT
- **ISC License:** https://opensource.org/licenses/ISC
- **Apache 2.0:** https://www.apache.org/licenses/LICENSE-2.0
- **Choose a License:** https://choosealicense.com/

### Compliance Tools

- **license-checker:** `npm install -g license-checker`
- **FOSSA:** https://fossa.com/
- **WhiteSource:** https://www.whitesourcesoftware.com/

### Legal Help

- **Open Source Initiative:** https://opensource.org/
- **Free Software Foundation:** https://www.fsf.org/
- **Creative Commons:** https://creativecommons.org/

---

## Summary

### ✅ What You Can Do

- Use for any purpose (personal, commercial, educational)
- Modify the code
- Distribute original or modified versions
- Sublicense under compatible terms
- Use in proprietary software

### ⚠️ What You Must Do

- Include LICENSE file
- Include NOTICE file
- Include copyright notices
- Include ATTRIBUTIONS.md
- Include THIRD_PARTY_LICENSES.md

### ❌ What You Cannot Do

- Hold authors liable
- Remove copyright notices
- Remove license files
- Use trademarks without permission
- Claim official endorsement

---

## Contact

**Legal Questions:**
- Email: legal@smartfarming.bd
- For non-legal questions: See [CONTRIBUTING.md](/CONTRIBUTING.md)

**License Violations:**
- Report via: legal@smartfarming.bd
- Include details and evidence
- We'll address promptly

---

**Last Updated:** February 2026  
**Document Version:** 1.0  
**Maintainer:** Smart Farming Legal Team
