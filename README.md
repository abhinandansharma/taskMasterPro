# TaskMaster Pro

A jQuery task manager laid out as a dashboard of colour blocks: add tasks with a priority and a due date, filter them with live counts, search with highlighting, edit inline, undo a delete, and run a Pomodoro focus timer with a focus sound that counts sessions against the task you link to. Everything is stored in the browser, survives a reload, installs as an app and works offline.

**Live:** https://abhinandansharma.github.io/taskMasterPro/

![TaskMaster Pro, dark mode](screenshots/dark.png)

## What it does

- **Add and edit.** One big input, Enter to add. Double-click a task (or the pencil) to change its text, priority and due date in place.
- **Active first, done below.** Open tasks stay at the top in the order you added them; ticked tasks drop into a "Completed" group underneath, newest first.
- **Priorities and due dates.** High, medium and low, shown as a dot. Due dates show as Today, Tomorrow, the weekday, or Overdue in lime.
- **Filters with counts.** All, active, completed, high priority and due today (which includes overdue), each with a live number.
- **Search.** Type in the list header and matches are highlighted; Escape clears.
- **Undo.** Deleting a task or clearing the completed ones shows an Undo for six seconds.
- **Progress.** Total, active and completed as bars, plus the completion figure set large.
- **Focus timer.** 25-minute focus sessions with 5-minute breaks and a 15-minute break every fourth session. Use the target on a task to link it; finished sessions are counted on that task, a chime plays, the tab title shows the countdown, and a system notification fires if the tab is in the background.
- **Background sound.** Rain, fireplace, ocean, wind, night, brown noise, a lo-fi beat, lo-fi with rain, or a soft pad, played by [ambiently](https://www.npmjs.com/package/ambiently) from the moment you pick one until you pick Off. All synthesised, nothing to download.
- **Backup.** Export your tasks as JSON from the footer and import them on another browser.
- **Installable and offline.** A web app manifest and a service worker: add it to your home screen or dock, and it opens without a connection.
- **Two themes.** Dark by default, light with one dark panel. The choice is remembered.
- **Keyboard.** Enter adds a task, `n` jumps to the input, `/` to the search, Escape clears it or cancels an edit, Space starts or pauses the timer.

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
