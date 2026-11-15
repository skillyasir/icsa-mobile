# Privacy answers for the 1.1.0 update (drafted 15 Nov 2026)

**Why:** the 1.0 answers (Play Data safety 11 Nov 2026, Apple App Privacy 11 Nov 2026) said the app never sends names or phones. Since then the app gained staff check-in, reception, marketers, managers and the Student Ambassador, which send more. Both stores require the answers to match what the app does, and to match the privacy policy.

**Order:** 1 → the policy (AMS › Site Pages), 2 → Play Console, 3 → App Store Connect (with the 1.1.0 iOS build, after Apple approves 1.0).

---

## 1. Privacy policy — lines to add to clause 02 "The ICSA mobile app" (for Yasir's approval)

Add after the "Attendance reminders (staff)" line. **Publish once AMS `d9b15467` is live** (the voucher line names the age; the AMS chat's wording, 15 Nov 2026):

> **Vouchers for a friend (students aged 18 and over).** If you give a friend an ICSA voucher in the app, you enter your friend's name and WhatsApp number. ICSA keeps them with the voucher: to check that your friend is new to ICSA, so that only that number can use it, and to show you how your friend is getting on. You never see your friend's fee or payments. Only give a friend's details if they are happy for you to share them with ICSA. Sending the voucher opens WhatsApp on your phone; the message is sent by you, from your WhatsApp.

> **Staff using the app.** ICSA staff use the app as they use the ICSA website: to register a student (the same details as the registration form), record a payment, log a follow-up call, decide approvals, and give a coupon to someone interested in a course (their name and mobile number). These details are kept in the ICSA system as described in this policy.

And change **Last Updated** to the day it is published.

---

## 2. Google Play — Data safety (Policy › App content › Data safety)

Unchanged from 1.0: **collects data: Yes · shared with third parties: No** (opening WhatsApp with a message the person chose to send is a user-initiated transfer, not sharing) · **encrypted in transit: Yes** · **account creation: out of app** · **deletion: https://icsa.us/privacy_policy**.

**Remove** the 1.0 note "Name and phone are not listed: the app shows them but never sends them" — it is no longer true.

Every type below: **collected, not shared, not processed ephemerally, App functionality.**

| Data type | What it is in the app | Required or optional | New in 1.1.0? |
|---|---|---|---|
| **Location — precise** | A student's check-in; a staff member's attendance taps; a manager's Add this router — only at the tap | Optional | wider (staff) |
| **Personal info — Name** | Registering a student; a coupon (marketer) or voucher (student) for a named person; follow-ups | Optional | **new** |
| **Personal info — Email address** | Sign-in; registering a student | Required | wider |
| **Personal info — User IDs** | The ICSA account | Required | — |
| **Personal info — Address** | Registering a student (home address) | Optional | **new** |
| **Personal info — Phone number** | Registering a student; a coupon or voucher (the friend's / person's WhatsApp number) | Optional | **new** |
| **Personal info — Other info** | Registering a student: national ID, date of birth, nationality, gender, country of residence, emergency contact | Optional | **new** |
| **Financial info — Other financial info** | A payment proof's amount; a payment recorded by reception; refunds, discounts and transfers a manager decides | Optional | wider |
| **Messages — Other in-app messages** | Comments on an assignment | Optional | — |
| **Photos** | A payment proof or an assignment, chosen by the person | Optional | — |
| **Files and docs** | An assignment handed in | Optional | — |
| **App activity — App interactions** | Lesson progress (in the lesson pages) | Required | — |
| **App activity — Other user-generated content** | Quiz answers, assignment work; follow-up call notes; reasons given for approvals | Optional | wider |
| **Device or other IDs** | This phone's sign-in record; **the office Wi-Fi router's name and hardware address at a staff tap** | Required | wider (Wi-Fi) |

*Judgement call to confirm in the console:* Play has no "network" type. The router's address is listed under **Device or other IDs** (it is an identifier read from the phone's connection) and named in the policy. If the console's help text points elsewhere, follow it.

No data is used for advertising or analytics, and none is sold.

---

## 3. Apple — App Privacy (App Store Connect › App Privacy)

1.0 published: Email Address, Precise Location, Photos or Videos, Other User Content, User ID, Product Interaction.

**Add**, each **App Functionality · Linked to the user · Not used for tracking**:

| Apple data type | What it is in the app |
|---|---|
| **Contact Info — Name** | Registering a student; a coupon or voucher for a named person |
| **Contact Info — Phone Number** | Registering a student; the friend's / person's number on a coupon or voucher |
| **Contact Info — Physical Address** | Registering a student |
| **Contact Info — Other User Contact Info** | A student's emergency contact |
| **Financial Info — Other Financial Info** | Payment proof amounts; payments recorded by reception; approvals |
| **Other Data — Other Data Types** | National ID, date of birth, nationality, gender (registration); the office Wi-Fi router at a staff tap |

**Keep:** Email Address, Precise Location (now also staff taps), Photos or Videos, Other User Content (now also follow-up notes and approval reasons), User ID, Product Interaction.

---

## Decided — the Ambassador and children (Yasir, 15 Nov 2026)

- **The Ambassador is for students aged 18 and over**, enforced by the AMS (`services/ambassadorAge.js`, AMS `d9b15467`), on the website and in the app alike. **No date of birth on file → not offered** until the front desk adds one.
- **Why:** the app's Play target audience includes children (6+), so Google's **Families policy** applies, and the Ambassador asks for another person's name and WhatsApp number, with a reward.
- **The app never works out an age.** It shows the Ambassador only when the AMS says the student may use it, and shows the AMS's own words when not.
