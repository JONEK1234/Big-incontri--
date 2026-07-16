# Security Specification for Samuel & Ilenia's Big Incontri App

## 1. Data Invariants
- **Encounters (meetings)**: Must contain a valid date string, a title up to 200 characters, note content, and the creation timestamp. No unapproved fields allowed.
- **Special Dates (special_dates)**: Must contain a valid date string, a title, a description, and a type that is strictly one of `anniversary`, `special_date`, or `milestone`.
- **Love Messages (love_messages)**: Must contain a valid sender (either `Samuel` or `Ile`/`Ilenia`), text message up to 2000 characters, and a timestamp.
- **Stickers (stickers)**: Must contain a Base64/url string, an uploader name, a creation timestamp, and optional title or associated meeting IDs list.

## 2. The "Dirty Dozen" Malicious Payloads
Here are 12 specific payloads designed to breach Identity, Integrity, or State:

### Encounter Collection Attacks
1. **The Ghost Field Injector (Shadow Field)**: Injecting an unapproved field `isVerifiedAdmin: true` to bypass system checks.
2. **Title Overload Attack**: Sending a title exceeding 200 characters to bloat database records.
3. **Huge General Note Attack**: Sending a note exceeding 5000 characters (e.g. huge text block) causing Denial of Wallet.
4. **Invalid Date Format Attack**: Sending `date: "not-a-date"`.

### Special Dates Collection Attacks
5. **Invalid Type Injector**: Attempting to set `type: "super_secret_admin_role"`.
6. **Title Overload Attack**: Title exceeding 200 characters.
7. **Huge Description Attack**: Description exceeding 1000 characters.

### Love Messages Collection Attacks
8. **Spoofed Sender Attack**: Sender set to `"Hacker"`.
9. **Text Overload Attack**: Text exceeding 2000 characters.

### Sticker Collection Attacks
10. **Spoofed Uploader Attack**: `uploadedBy` set to `"EvilUser"`.
11. **Huge Sticker Payload Attack**: Sending a sticker URL exceeding 10,000,000 characters.
12. **Malicious ID Poisoning Guard**: Sending a non-standard document path variable or non-alphanumeric junk characters as ID.

## 3. Conceptual Security Test Runner
All 12 of the above payloads are evaluated by the validation helpers and must return `PERMISSION_DENIED` on any write attempts.
