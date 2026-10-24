# RIO compared with other marketplaces

Researched October 2026. Sources are listed at the end. Where only third-party or
self-reported information was available, that is noted. This is a product comparison,
not a market study.

## Who RIO competes with

| Product | What it is | Relevance to RIO |
|---|---|---|
| **OLX India** | General classifieds: list anything, buyers message sellers, payment and meeting arranged off-platform | What students use today for move-out sales |
| **Facebook Marketplace** | Local classifieds inside Facebook, with Messenger chat, seller ratings and (now) shipping and AI-assisted listings | The most polished general marketplace |
| **Quikr** | Classifieds similar to OLX | Same model as OLX |
| **CampusKart, OpenShelf, Campus Street** | Student-only marketplaces for books, electronics and hostel items | Closest in audience; all are early or small |

## Feature matrix

| | OLX | Facebook Marketplace | Campus apps | **RIO** |
|---|---|---|---|---|
| Browse without an account | yes | partly | OpenShelf: yes | **yes** |
| Photos on listings | yes | yes | yes | **yes**: compressed in the browser, with a small preview copy for grids |
| Search, categories, price filters | yes | yes | basic | **yes**, plus condition, rentable and a "leaving soonest" sort |
| Pricing help | none | AI listing suggestions | none | **Deadline pricing**: the price falls automatically to the seller's floor before they leave |
| In-app chat | yes | yes (Messenger) | varies | **not yet** |
| Payment held until handover | no, off-platform (UPI/cash) | only with shipping checkout | no | **yes: escrow released by a one-time QR code** (simulated in Level 1) |
| Proof of handover | no | no (local pickup) | no | **yes: single-use, expiring, receiver-bound code** |
| Renting and rent-to-own | no | no | no | **yes** |
| Seller ratings | limited | yes | some | **yes**: only after a completed purchase or returned rental, one per transaction |
| Report a listing / moderation | yes, at scale | yes | varies | **yes**: reports go to a warden for that hostel; reporters stay anonymous |
| Disputes | no formal process | for shipped orders | no | **yes**: an uninvolved warden decides, with private evidence |
| Restricted to campus | no | no | yes | partly: hostels and wardens are modelled; campus email verification is planned |
| Unsold items | stay listed or get dumped | same | same | **routed to campus staff in the owner's final hour** |
| Sharing to group chats | yes | yes | varies | **yes**: native share sheet or copy link |
| Notifications | yes | yes | varies | **not yet** |
| Fees | free plus paid boosts | seller fees on shipped orders | free | free (pilot) |

## What RIO does that the others don't

1. **It solves the move-out deadline.** The others assume a seller can wait; a departing student
   can't. Automatic price decay with a visible floor and a staff hand-off at the end is unique here.
2. **Scam resistance by design.** OLX's best-documented problem is scammers moving buyers to
   WhatsApp and UPI. RIO keeps payment in escrow until the buyer scans the seller's one-time code
   in person.
3. **Rent and rent-to-own** for students staying a term rather than buying.
4. **Campus operations built in**: wardens, staff custody, no-dues checks and impact estimates.

## Gaps, in priority order

| Priority | Gap | Status |
|---|---|---|
| Done | Seller ratings | Built: one per completed transaction, average shown on listings |
| Done | Report a listing, with warden moderation | Built |
| Done | Share to WhatsApp and other apps | Built |
| Done | Real listing photos | Built: browser compression with a preview copy, plus demo photos |
| 1 | In-app chat between buyer and seller | Not built. Supabase Realtime fits the free tier, but chat needs moderation, abuse reporting and retention rules first |
| 2 | Notifications (claim received, code scanned, rental due) | Not built. Email via Brevo is possible within the free 300/day |
| 3 | Campus email verification (e.g. only `@sharda.ac.in`) | Not built. A sign-up domain allow-list is a small change once the campus confirms its domains |
| 4 | "Wanted" requests (post what you're looking for) | Not built |
| 5 | Real payments | Out of scope for Level 1 (regulated; needs a payment gateway) |

## Sources

- OLX scam patterns and user reports: [techenclave (1)](https://techenclave.com/t/olx-used-gpu-scam-attempt-be-careful-with-olx-sellers/437405), [techenclave (2)](https://techenclave.com/t/how-to-deal-on-olx/438125/11), [miniOrange](https://cyberforensics.miniorange.com/saving-yourself-from-the-olx-army-scam), [Morung Express (older article)](https://mail.morungexpress.com/how-fraudsters-attempt-cheat-olx-quikr-users), [Trustpilot (self-reported reviews)](https://trustpilot.com/review/www.olx.in)
- Facebook Marketplace features: [TechCrunch, March 2026](https://techcrunch.com/2026/03/12/facebook-marketplace-now-lets-meta-ai-respond-to-buyers-messages), [overview](https://alejandrorioja.com/facebook-marketplace/)
- Campus marketplaces (self-descriptions): [CampusKart](https://www.hunted.space/product/campuskart), [OpenShelf](https://www.producthunt.com/products/openshelf), [Campus Street](https://yourstory.com/companies/campus-street)
