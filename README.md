# Creator Desk
A local workspace for UGC creators, built with React, Vite, Express, and SQLite.

## Run locally
Requires Node.js 22.13 or newer (Node 24+ recommended).

```sh
npm install
npm run dev
```
Open http://127.0.0.1:5173. The API listens on port 3001. Both services bind to your device only.

For a production build:
```sh
npm run build
npm start
```
Open http://127.0.0.1:3001.

## Features
- Rename, create, and open local workspaces from the workspace name in the sidebar or header. Each workspace has separate deals, tasks, calendars, and income totals; the browser remembers the last opened workspace.
- Create, edit, delete, search and filter deals through In Discussion, Agreed, Signed, In Progress, and Completed.
- Paid, Free, and Exchange compensation, with product/exchange notes.
- Fixed deadlines or calendar days from product receipt. Unknown arrival dates remain unscheduled.
- Retroactive deal, delivery, arrival, and payment dates.
- Per-deal task checklist and notes, upcoming deadlines, and a monthly calendar for delivery and payment dates.
- Monthly, year-to-date and trailing 30-day cash received and booked compensation totals; outstanding agreed payments across all time.
- A payment ledger; mark a full payment received by entering its received date.

All cash uses USD. Booked compensation includes all paid deals by deal date, including discussions; unpaid totals exclude discussions. The income periods end today and trailing 30 days includes today. Free and Exchange deals do not contribute cash income. Payment installments, taxes, automatic reminders, multiple currencies, and multi-user accounts are outside this initial version.

## Data & checks
Data persists in `data/creator-desk.sqlite`, excluded from Git. Existing deals are automatically kept in the original workspace when upgrading. All workspaces share this database; they are organizational spaces, not separate user accounts. Back up the data directory with the server stopped. No sample deals are inserted. This is a single-user local app; do not expose it directly to the internet.

```sh
npm test
npm run build
```

## Export and import
Open the workspace name in the sidebar or header, then use **Export & import**.

- **Export workspace** downloads a versioned JSON backup of the current workspace, including deals, payment details, notes, dates, and checklist items.
- On another machine running Creator Desk, choose the JSON backup, review its name and deal count, then select **Import & open**. Imports create a new workspace with fresh deal IDs and preserve creation dates; matching names receive an “(imported)” suffix. Existing workspaces are never overwritten. Invalid imports are rejected without partial changes. Maximum import size: 50 MB / 20,000 deals.
- **Export CSV** supports the current workspace or all workspaces, independent of the current search or stage filter. Choose **All deal details**, **To-do checklist items** (one row per task), or **Income summaries** (one row per workspace and dashboard period). Deals include the complete checklist as JSON, task counts, notes, computed deadlines, compensation, received amounts, and outstanding amounts.
- Income summaries use the browser’s current date, USD, and the same month-to-date, year-to-date, trailing 30-day, and all-time outstanding rules as the dashboard.
- CSV files use UTF-8 with a BOM and quoted fields for spreadsheet compatibility. Formula-like text is prefixed with an apostrophe so it is treated as text. CSV is for reporting; use the JSON backup for lossless workspace transfers.

## Late payments
Overview and Income show all unpaid, agreed paid deals whose payment due date is before today, including completed projects. Each flag shows the brand, amount, due date and days late. Due-today payments are not overdue. Unfinished paid deals without an explicit payment due date show “Due 30 days after completion.” Record the payment received date to clear the overdue flag. Discussions, Free/Exchange deals, and zero-value deals are excluded. Late-payment totals are all-time and independent of the selected earnings period; workspace scoping still applies. CSV deal details and income summaries include overdue information.

## Default payment terms
Paid deals with no explicit payment due date default to 30 calendar days after the date they are marked Completed. The editable **Completed on** date supports backdated entries. Editing that date recalculates an automatic due date, while explicit due dates take precedence. Clear an explicit payment date to return to automatic terms. Reopening a deal clears its completion date and automatic payment deadline; completing it again starts a new 30-day period.

All workspaces are upgraded automatically at server startup. Older completed deals that already have a completion date use it. If an older deal or imported backup has no recorded completion date, the upgrade/import date is used as a clearly labeled estimate; open the deal and correct **Completed on** to set the historical deadline accurately. Existing explicit payment dates are never overwritten. Backups and CSV deal exports preserve completion dates, the estimate flag, and whether the deadline is automatic or manual.
