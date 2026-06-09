# AGENTS.md — CURATION PLATFORM

## Role

You are helping build a premium visual curation platform.

The user wants a place to collect inspiration across:

* fashion
* furniture
* interiors
* architecture
* art
* digital art
* objects
* design references

The user values aesthetics, simplicity, and usability far more than feature count.

The product should feel like a design object, not a software tool.

---

## Project Vision

The goal is not to build another Pinterest.

The goal is to build a calm, beautiful personal archive for visual inspiration.

The experience should feel:

* premium
* editorial
* intentional
* tactile
* minimalist
* image-first
* emotionally inspiring

Think:

* Cosmos
* Are.na
* high-end architecture websites
* luxury fashion editorials
* curated coffee table books

---

## Core Philosophy

Design quality is the primary feature.

If choosing between:

* more functionality
* better aesthetics

always choose better aesthetics.

If choosing between:

* more options
* simpler interaction

always choose simpler interaction.

---

## Current Scope

Only implement:

* authentication
* collections
* image saving
* image uploads
* image URLs
* categories
* tags
* search
* item detail pages

Everything else requires explicit approval.

---

## Do Not Implement

Do not add:

* likes
* comments
* followers
* social feeds
* notifications
* messaging
* AI features
* recommendations
* analytics dashboards
* productivity tools
* gamification
* public profiles
* complex settings
* sharing systems

Unless explicitly requested.

---

## Visual Direction

The interface should feel:

* invisible
* calm
* refined
* spacious
* effortless

Use:

* large imagery
* generous whitespace
* subtle borders
* elegant typography
* soft motion
* restrained color palettes

Avoid:

* SaaS dashboards
* startup aesthetics
* heavy cards
* excessive shadows
* neon gradients
* loud colors
* dense interfaces
* unnecessary labels
* generic UI kits

---

## Layout Principles

Images are the primary content.

Text is secondary.

UI controls should stay visually quiet.

Prioritize:

* masonry layouts
* clean grids
* immersive detail views
* strong visual hierarchy

The user should spend most of their time looking at images, not interface elements.

---

## Motion Design

Motion should feel premium and subtle.

Use:

* soft fades
* spring animations
* staggered reveals
* smooth page transitions
* gentle hover interactions

Avoid:

* flashy animations
* large transforms
* excessive parallax
* distracting motion

Motion should support the content, not compete with it.

---

## Typography

Typography is part of the product identity.

Prefer:

* Geist
* Inter
* Instrument Serif

Maintain:

* strong hierarchy
* generous spacing
* minimal text

Avoid:

* decorative fonts
* excessive font weights
* crowded typography

---

## Technical Rules

* Use Next.js App Router.
* Use TypeScript.
* Use TailwindCSS.
* Use Supabase.
* Keep components small.
* Keep code readable.
* Avoid premature abstractions.
* Avoid unnecessary dependencies.
* Do not rewrite large sections of the project without approval.
* Do not refactor unrelated files.
* Ask before deleting files.

---

## Data Rules

Support two image sources:

1. Uploaded images
2. Remote image URLs

Never assume all images come from Supabase Storage.

Remote URLs and uploaded images must both work correctly.

Always handle invalid image URLs gracefully.

Never crash the application because of image failures.

---

## Work Discipline

Implement one focused improvement at a time.

Do not combine:

* feature work
* redesigns
* refactors
* cleanup

into a single task.

If a request affects more than 3 files, explain the plan first.

Prefer iterative improvements.

---

## Design Review Standard

Before considering a task complete, ask:

1. Is this simpler?
2. Is this cleaner?
3. Is this more beautiful?
4. Is this more intuitive?
5. Can something be removed?

Removing clutter is often better than adding functionality.

---

## Build & Validation

After changes:

* run npm run lint when available
* run npm run build when available

Report failures clearly.

Do not ignore TypeScript errors.

---

## Completion Report

After each task provide:

* Summary
* Files Changed
* Commands Run
* Build Result
* Follow-up Suggestions

Keep reports concise.
