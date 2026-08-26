# Ping — Phase 22 online safety preparedness record

**Prepared:** 26 August 2026  
**Status:** pre-launch product record; not legal certification or a substitute for a formal Ofcom-compliant risk assessment.

## 1. Service description

Ping is a location-based user-to-user service for short-lived local updates. Users can create Pings, attach one image, reply, confirm, mark Helpful, search nearby Pings and view Pings on a map. Public browsing is available without an account; posting, replying, reporting and other community actions require authentication. Paid Promoted Pings are moderated local placements.

For planning purposes Ping should assume the Online Safety Act user-to-user duties may apply. A final legal scope determination must be completed before public launch.

Current Ofcom references:
- Illegal content duties: https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/illegal-content-duties-under-the-online-safety-act
- Protection of children duties: https://www.ofcom.org.uk/online-safety/protecting-children/protection-of-children-duties-under-the-online-safety-act
- Children's access assessment duties: https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/childrens-access-assessment-duties-under-the-online-safety-act

## 2. Children's access assessment — product conclusion

Ping accounts are restricted by product terms and signup self-declaration to people aged 13 or over. People aged 13–17 are therefore permitted users, and public browsing does not require an account. Ping should consequently treat the service as **likely to be accessed by children** and plan for the child-safety duties rather than relying on an adults-only assumption.

This is an internal product conclusion, not the final statutory assessment. Before public launch Ping must complete and retain the formal children's access assessment and, because children are expected to access the service, a suitable and sufficient children's risk assessment using the then-current Ofcom guidance.

## 3. Principal risk areas identified for formal assessment

The formal illegal-content and children's risk assessments should at minimum examine:

- child sexual abuse/exploitation material and grooming-related use;
- credible threats, harassment, stalking and doxxing;
- hate offences and targeted abuse;
- terrorism-related illegal content;
- fraud, scams and deceptive local listings;
- illegal sale or facilitation of drugs, weapons, stolen goods or other prohibited products/services;
- encouraging or assisting serious self-harm;
- cyberflashing or sexual image abuse through photo uploads;
- exposure of a child's or vulnerable person's exact home, school, routine or contact information;
- misuse of location, photos or replies to identify or target a person;
- spam, impersonation and manipulation of local information;
- risks introduced by search, map discovery and promoted local placement.

## 4. Existing product mitigations

Ping already includes the following controls:

- authentication required for posting, replying, reporting and community actions;
- public Ping locations are approximate rather than exact coordinates;
- nearby radius limits and privacy-filtered Feed/Map/search queries;
- photos are client-side re-encoded before upload to reduce EXIF/GPS metadata leakage;
- image MIME/size restrictions and ownership-scoped storage controls;
- report flow routed through guarded server/database logic;
- block and hide controls;
- moderator report queue, case history and promotion review workflow;
- anti-spam controls on community activity;
- normal Pings are temporary and designed to stop public display after about 24 hours;
- no direct messages in the current product;
- no public email, exact location, home address or broad personal bio on profiles;
- reputation explicitly describes activity rather than identity verification;
- Promoted Pings require moderation and are labelled as paid placement;
- no behavioural advertising or personalised ad tracking in the current product;
- optional product analytics is off unless the browser user explicitly allows it;
- public Safety page explains emergency limitations, reporting, complaints and child-safety guidance;
- tracked safety complaints and moderation appeals are stored with user-scoped RLS and moderator-only review access.

## 5. Required work before public launch

The following are launch blockers or formalisation tasks, not optional polish:

1. Complete and retain a suitable and sufficient illegal-content risk assessment using current Ofcom guidance/risk profiles.
2. Complete and retain the formal children's access assessment and children's risk assessment.
3. Name an individual accountable for online-safety compliance and publish an appropriate safety/contact route.
4. Define operational complaint acknowledgement, review and escalation targets, including moderation appeals.
5. Define urgent escalation for suspected child sexual abuse/exploitation, credible threats and other priority illegal content, including lawful preservation/referral procedures.
6. Define evidence-retention rules for reports, moderation decisions and safety incidents, balanced against data-minimisation duties.
7. Define repeat-offender/account-restriction procedures and document how enforcement decisions are reviewed.
8. Review search, map, photo and promotion features against the risk assessments before significant changes ship.
9. Establish at least annual risk-assessment review, plus review before significant product changes or when Ofcom materially updates risk profiles.
10. Complete final legal review of Terms, Privacy Notice, controller/operator identity, governing terms, provider transfers and live-payment/refund terms.
11. Decide whether the 13+ self-declaration remains proportionate after the children's risk assessment or whether stronger age-assurance measures are required.
12. Enable and verify appropriate account-security controls, including leaked-password protection, before public launch.

## 6. Governance decision

Until the formal assessments above are complete, Ping must not describe itself as Online Safety Act compliant. Phase 22 establishes practical reporting, complaint, privacy and analytics controls and records the known risks so that closed-beta and public-launch decisions have an auditable baseline.
