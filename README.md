# TaskMaster Pro

A jQuery task manager laid out as a dashboard of colour blocks: type tasks in plain words ("Pay rent tomorrow !high every month"), drag them into order, tick repeating ones forward, filter with live counts, search with highlighting, edit inline, undo anything, and run a Pomodoro focus timer with background sound. Everything is stored in the browser, survives a reload, installs as an app, works offline, and travels to another device inside a link.

**Live:** https://abhinandansharma.github.io/taskMasterPro/

![TaskMaster Pro, dark mode](screenshots/dark.png)

## What it does

- **Add in plain words.** One big input, Enter to add. Words like `tomorrow`, `friday`, `next week`, `in 3 days`, `!high`, `!low`, `every day`, `every weekday`, `every monday` or `monthly` are understood and stripped from the title; a hint under the input shows what was read before you press Enter.
- **Edit in place.** Double-click a task (or the pencil) to change its text, priority, due date and repeat.
- **Active first, done below.** Open tasks stay at the top in your order; ticked tasks drop into a "Completed" group underneath, newest first.
- **Drag to reorder.** Grab the dots at the left of a row, on mouse or touch. Or focus a row and press Alt with the up and down arrows.
- **Repeating tasks.** Daily, weekdays, weekly or monthly. Ticking one moves it to its next date instead of completing it, with an Undo; an overdue repeat catches up to the present.
- **Priorities and due dates.** High, medium and low, shown as a dot. Due dates show as Today, Tomorrow, the weekday, or Overdue in lime.
- **Filters with counts.** All, active, completed, high priority and due today (which includes overdue), each with a live number.
- **Search.** Type in the list header and matches are highlighted; Escape clears.
- **Undo.** Deleting a task, clearing the completed ones or ticking a repeating task shows an Undo for six seconds. Cmd or Ctrl+Z does the same.
- **Progress.** Total, active and completed as bars, plus the completion figure set large.
- **Focus timer.** 25-minute focus sessions with 5-minute breaks and a 15-minute break every fourth session. Use the target on a task to link it; finished sessions are counted on that task, a chime plays, the tab title shows the countdown, and a system notification fires if the tab is in the background.
- **Background sound.** Rain, fireplace, ocean, wind, night, brown noise, a lo-fi beat, lo-fi with rain, or a soft pad, played by [ambiently](https://www.npmjs.com/package/ambiently) from the moment you pick one until you pick Off. All synthesised, nothing to download.
- **Send to another device.** "Send to device" in the footer copies a link that carries all your tasks, compressed into the address. Open it on your phone or another browser and choose to add them to what is there or replace it. No account, no server.
- **Backup.** Export your tasks as JSON from the footer and import them on another browser.
- **Installable and offline.** A web app manifest and a service worker: add it to your home screen or dock, and it opens without a connection.
- **Five palettes, each in dark and light.** Lime (the default), Dracula, Nord, Catppuccin (Mocha, or Latte in light mode) and Lord's (antique gold on warm beige, by [@Lord-V15](https://github.com/Lord-V15)). Every palette stays one accent plus neutrals, so the app never looks like a different product. Picked from the top bar and remembered, and applied before the first paint so nothing flashes.
- **Keyboard and screen readers.** Enter adds a task, `n` jumps to the input, `/` to the search, Escape clears it or cancels an edit, Space starts or pauses the timer, arrows walk the list, Alt+arrows reorder, Cmd/Ctrl+Z undoes. Moves, completions and repeats are announced to assistive tech.

## Light mode

![TaskMaster Pro, light mode](screenshots/light.png)

## On a phone

<img src="screenshots/mobile.png" width="360" alt="TaskMaster Pro on a phone" />

## Stack

Plain HTML, CSS and jQuery 3.5. No build step. Space Grotesk for text and [Geist Pixel](https://vercel.com/font) (Square) for the numerals, self-hosted. The focus sound is the [ambiently](https://github.com/abhinandansharma/ambiently) engine, vendored from the npm package as `assets/JS/lib/ambiently-1.0.0.js` and imported on first use. Tasks live in `localStorage` under `taskmaster.tasks`, the timer under `taskmaster.pomodoro`, the sound volume under `taskmaster.sound`.

## Run it locally

Clone the repository and open `index.html`, or serve the folder:

```bash
python3 -m http.server 4000
# http://localhost:4000
```

## License

MIT. Geist Pixel is licensed under the SIL Open Font License, see `assets/fonts/GEIST-LICENSE.txt`.

Built by [Abhinandan Sharma](https://abhinandansharma.github.io/portfolio/).
