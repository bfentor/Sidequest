# Sidequest to-do

Markers:
- **[store]**: Apple or Google requires it (or reviewers commonly reject without it) for an app with accounts and user-generated content.
- **[API ready]**: the backend already supports it; only the app screens are missing.

Delete what you don't want, tick off what's done (`- [x]`), and reorder freely.

## 1. Required before launch

- [x] **[store]** Delete your account from inside the app (Apple requires it)
- [x] **[store]** Report posts, events and profiles
- [x] **[store]** Block and mute users
- [x] **[store]** Moderation queue where reported content gets reviewed and removed
- [x] **[store]** Terms of service and privacy policy, linked in the app and accepted at signup
- [ ] **[store]** Sign in with Apple, if any other social login is added
- [x] Email verification
- [x] Password reset screens (backend part done)
- [x] GDPR: export my data, and delete my data

- [ ] Write the real terms of service and privacy policy (placeholders in `apps/app/src/legal/documents.ts`; bump `TERMS_VERSION` in the API settings when they change)
- [ ] Decide the minimum age (`MINIMUM_AGE`, now 16; Finland's age of digital consent is 13)

## 2. Accounts and sign-in

- [ ] Sign in with Google and Apple
- [x] Student verification through a university email domain, plus a "verified student" badge
- [x] Change email or password
- [x] Two-factor authentication (allauth supports it)
- [ ] Onboarding after signup: pick interests, follow suggested organizations, allow location
- [x] See and sign out other devices

## 3. Profiles

- [x] **[API ready]** Edit profile screen: display name, handle, bio
- [x] Profile picture upload (needs file storage) and a cover image
- [x] Extra fields: university, faculty, study year, pronouns, interests, links (Instagram, website)
- [x] **[API ready]** Other people's profile pages with a follow button
- [x] Followers and following lists
- [ ] Privacy settings: private account (follow requests), hide followers, hide attended events
- [x] Verified badge for official organizations

## 4. Organizations

- [x] Create an organization in the app (currently only possible through the admin)
- [x] Invite and remove members, and assign roles (admin, editor)
- [ ] **[API ready]** Switch which profile you're acting as when posting
- [x] Organization page with tabs for upcoming events, past events, posts and members
- [x] Verification process for student unions, guilds and clubs

## 5. Creating and editing events

- [x] **[API ready]** Create, edit and delete events
- [ ] Location picker: address search plus a map pin (address search done; map pin comes with the map view)
- [x] Cover image
- [ ] Categories and tags (party, sports, academic, career, culture and so on)
- [x] Online events with a meeting link
- [x] Recurring events (weekly club meetings)
- [x] Price or "free", and a link to buy tickets
- [x] Capacity limit and waitlist
- [x] Visibility: public, followers only, or unlisted (link only)
- [x] Audience restrictions: only students of a given university, or 18+
- [x] Drafts and scheduled publishing
- [x] Mark an event as cancelled or postponed, and notify people who are going
- [x] Co-hosts, so several organizations run one event
- [x] Duplicate an event

## 6. Going to events

- [x] RSVP as "going" or "interested", with attendee counts
- [x] "Friends who are going"
- [x] My events: a calendar or list of events I'm going to
- [x] Saved or bookmarked events
- [x] Add to calendar (iCal, Google Calendar)
- [x] Shareable event links
- [ ] Reminders before an event
- [ ] Q&A or comments on events
- [ ] QR check-in at the door
- [ ] Photos and feedback after the event

## 7. Feeds, search and discovery

- [x] Search for events, people and organizations
- [x] Filters: date range, category, free only, distance
- [x] Quick filters: today, tonight, this weekend
- [x] Map view for the nearby feed
- [x] Browse by category
- [x] Trending or popular events
- [x] Algorithmic "For you" feed, ranked by interests, who you follow, which friends are going, popularity and how close the event is
- [x] "Who to follow" suggestions
- [x] Following feed: show each event once (not both the announcement and later reposts), and optionally hide past events

## 8. Posts and social features

- [ ] **[API ready]** Write a post (text, or sharing an event)
- [ ] Images in posts
- [ ] Edit and delete posts
- [ ] Likes and reactions
- [ ] Comments
- [ ] Reposting or sharing events to your followers
- [ ] @mentions, hashtags and link previews
- [ ] Direct messages (a large feature with heavy moderation needs)
- [ ] A group chat for each event

## 9. Notifications

- [x] Push notifications
- [x] In-app notification inbox
- [ ] Event reminders
- [x] Alerts when an event you're going to changes or gets cancelled
- [x] New follower and new event from someone you follow
- [ ] Weekly email digest of upcoming events
- [x] Settings for which notifications you receive

## 10. Organizer tools (mostly for the desktop web app)

- [ ] Organizer dashboard: views, RSVPs and follower growth
- [ ] Export the attendee list as CSV
- [ ] Send announcements to people who are going
- [ ] Bulk import events from CSV, or sync them from an organization's existing calendar
- [ ] An embeddable event widget for organizations' own websites

## 11. Web

- [ ] Public event pages that search engines can index, with link previews when shared on WhatsApp, Instagram and similar
- [ ] A landing page for people who don't have the app
- [ ] Installable as a web app (PWA)
- [ ] Keyboard shortcuts and a wider desktop layout (for example a side panel with event details)

## 12. Safety and abuse prevention

- [x] Rate limiting on posting, following and signup
- [ ] Spam and profanity filters, and moderation of uploaded images
- [x] Audit log of moderation actions
- [x] Age gate or minimum age

## 13. Language and accessibility

- [x] Finnish, Swedish and English translations
- [ ] Screen reader labels, support for the system text size setting, and reduced motion

## 14. Infrastructure and operations

- [ ] Production hosting, a managed PostGIS database, file storage for images and a CDN
- [ ] An email-sending service
- [ ] Error tracking (Sentry)
- [ ] Privacy-friendly usage analytics
- [ ] Background jobs (Celery) for reminders and digests
- [ ] Backups and a staging environment
- [ ] App icon, splash screen, branding and app store listing assets
- [ ] End-to-end tests in CI
- [ ] Feature flags
- [x] Semantic versioning on commit

## 15. Speed and offline use

- [ ] Cached feeds, so the app opens instantly and works offline
- [ ] Image caching
- [ ] Skeleton loaders instead of spinners
- [ ] Instant UI updates for follows and RSVPs, without waiting for the server

## 16. Making money (later)

- [ ] Promoted events
- [ ] Paid ticketing (Stripe); tickets to physical events don't have to go through Apple's or Google's in-app purchase system
- [ ] Premium tools for organizations
