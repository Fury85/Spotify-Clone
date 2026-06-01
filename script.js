let songs = [];
let currFolder = "";
let lastVolume = 0.5;
let isSeeking = false;

const currentSong = document.getElementById("player");
const playIcon = document.getElementById("play");
const previousBtn = document.getElementById("previous");
const nextBtn = document.getElementById("next");
const volumeInput = document.getElementById("volume");
const volumeIcon = document.querySelector(".volume-icon");
const seekbar = document.getElementById("seekbar");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.querySelector(".sidebar-overlay");

function getTrackUrl(folder, track) {
    return new URL(`${folder}/${track}`, window.location.href).href;
}

/** Sidebar drawer + hamburger: viewport width 768px and below */
const MOBILE_BREAKPOINT = 768;

function formatSecondsToMinutes(seconds) {
    if (!Number.isFinite(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getTrackNameFromSrc(src) {
    return decodeURIComponent(src.split("/").pop());
}

function isMobileLayout() {
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
}

function openSidebar() {
    if (!isMobileLayout()) return;
    sidebar.classList.add("is-open");
    sidebarOverlay.classList.add("is-visible");
    document.body.classList.add("sidebar-open");
}

function closeSidebar() {
    sidebar.classList.remove("is-open");
    sidebarOverlay.classList.remove("is-visible");
    document.body.classList.remove("sidebar-open");
}

/** Reads every subfolder inside Music **/
async function getMusicFolders() {
    const response = await fetch("Music/");
    const html = await response.text();
    const div = document.createElement("div");
    div.innerHTML = html;

    const folders = new Set();

    for (const link of div.querySelectorAll("a")) {
        const href = link.getAttribute("href");
        if (!href || href.includes("..") || href.includes(".htaccess")) continue;

        let folderName = "";

        if (href.endsWith("/")) {
            folderName = href.replace(/\/$/, "").split("/").pop();
        } else if (!href.includes(".") && !href.startsWith("http")) {
            folderName = href.split("/").pop();
        }

        if (folderName && folderName.toLowerCase() !== "music") {
            folders.add(folderName);
        }
    }

    return Array.from(folders).sort((a, b) => a.localeCompare(b));
}

async function getAlbumInfo(folder) {
    try {
        const res = await fetch(`Music/${folder}/info.json`);
        if (!res.ok) throw new Error("No info.json");
        return await res.json();
    } catch {
        const label = folder.toUpperCase();
        return {
            title: label,
            description: folder === "cs" ? "Copyright songs" : folder === "ncs" ? "No copyright songs" : "Playlist",
        };
    }
}

async function getSongs(folder) {
    currFolder = folder;
    const response = await fetch(`${folder}/`);
    const html = await response.text();
    const div = document.createElement("div");
    div.innerHTML = html;

    songs = [];
    for (const link of div.querySelectorAll("a")) {
        const href = link.getAttribute("href");
        if (href && href.endsWith(".mp3")) {
            songs.push(decodeURIComponent(href.split("/").pop()));
        }
    }

    const songUL = document.querySelector(".song-list ul");
    songUL.innerHTML = "";

    if (songs.length === 0) {
        songUL.innerHTML = `<li class="empty-state">No songs in this playlist yet.</li>`;
        return songs;
    }

    let albumInfo = { description: "Artist" };
    try {
        const folderName = folder.split("/").pop();
        albumInfo = await getAlbumInfo(folderName);
    } catch {
        /* use default artist label */
    }

    for (const song of songs) {
        const title = decodeURIComponent(song).replace(/\.mp3$/i, "").replaceAll("%20", " ");
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "song-track-btn";
        btn.dataset.track = song;
        btn.innerHTML = `
            <img src="Icons/music.svg" alt="" draggable="false">
            <div class="info">
                <div>${title}</div>
                <div>${albumInfo.description}</div>
            </div>
            <div class="play-now">
                <span class="play-now-label">Play Now</span>
                <img src="Icons/play.svg" alt="" draggable="false">
            </div>`;
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            playMusic(btn.dataset.track);
            closeSidebar();
        });
        li.appendChild(btn);
        songUL.appendChild(li);
    }

    return songs;
}

function playMusic(track, pause = false) {
    currentSong.src = getTrackUrl(currFolder, track);
    document.querySelector(".songinfo").textContent = decodeURIComponent(track)
        .replace(/\.mp3$/i, "")
        .replaceAll("%20", " ");
    document.querySelector(".songtime").textContent = "00:00 / 00:00";
    seekbar.value = "0";

    if (!pause) {
        currentSong.play().catch(() => {});
        playIcon.src = "Icons/pause.svg";
    } else {
        playIcon.src = "Icons/play.svg";
    }
}

async function displayAlbums() {
    const folders = await getMusicFolders();
    const cards = document.querySelector(".cards");
    cards.innerHTML = "";

    if (folders.length === 0) {
        cards.innerHTML = `<p class="empty-state">Add a folder inside <strong>Music/</strong> with <code>info.json</code>, <code>cover.webp</code>, and <code>.mp3</code> files.</p>`;
        return;
    }

    for (const folder of folders) {
        const info = await getAlbumInfo(folder);

        cards.innerHTML += `
            <article data-folder="${folder}" class="card">
                <div class="play" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" aria-hidden="true">
                        <path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80L0 432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z" />
                    </svg>
                </div>
                <img src="Music/${folder}/cover.webp" alt="${info.title} cover"
                    onerror="this.src='Icons/music.svg'; this.classList.add('cover-fallback');">
                <h3>${info.title}</h3>
                <p>${info.description}</p>
            </article>`;
    }

    document.querySelectorAll(".card").forEach((card) => {
        card.addEventListener("click", async (e) => {
            e.preventDefault();
            const folder = card.dataset.folder;
            songs = await getSongs(`Music/${folder}`);
            if (songs.length > 0) {
                playMusic(songs[0]);
            }
            closeSidebar();
        });
    });
}

async function main() {
    currentSong.volume = parseFloat(volumeInput.value);

    const folders = await getMusicFolders();
    if (folders.length > 0) {
        await getSongs(`Music/${folders[0]}`);
        if (songs.length > 0) {
            playMusic(songs[0], true);
        }
    }

    await displayAlbums();

    playIcon.closest("button").addEventListener("click", (e) => {
        e.preventDefault();
        if (currentSong.paused) {
            currentSong.play().catch(() => {});
            playIcon.src = "Icons/pause.svg";
        } else {
            currentSong.pause();
            playIcon.src = "Icons/play.svg";
        }
    });

    currentSong.addEventListener("timeupdate", () => {
        const { currentTime, duration } = currentSong;
        document.querySelector(".songtime").textContent =
            `${formatSecondsToMinutes(currentTime)} / ${formatSecondsToMinutes(duration)}`;

        if (!isSeeking && duration > 0) {
            seekbar.value = String((currentTime / duration) * 100);
        }
    });

    seekbar.addEventListener("input", (e) => {
        e.stopPropagation();
        isSeeking = true;
        if (currentSong.duration > 0) {
            currentSong.currentTime = (parseFloat(e.target.value) / 100) * currentSong.duration;
        }
    });

    seekbar.addEventListener("change", () => {
        isSeeking = false;
    });

    seekbar.addEventListener("click", (e) => e.stopPropagation());
    seekbar.addEventListener("mousedown", (e) => e.stopPropagation());

    document.querySelector(".hamburger").addEventListener("click", openSidebar);
    document.querySelector(".close").addEventListener("click", closeSidebar);
    sidebarOverlay.addEventListener("click", closeSidebar);

    window.addEventListener("resize", () => {
        if (!isMobileLayout()) {
            closeSidebar();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeSidebar();
    });

    previousBtn.closest("button").addEventListener("click", (e) => {
        e.preventDefault();
        const currentTrack = getTrackNameFromSrc(currentSong.src);
        const index = songs.indexOf(currentTrack);
        if (index > 0) {
            playMusic(songs[index - 1]);
        }
    });

    nextBtn.closest("button").addEventListener("click", (e) => {
        e.preventDefault();
        const currentTrack = getTrackNameFromSrc(currentSong.src);
        const index = songs.indexOf(currentTrack);
        if (index >= 0 && index + 1 < songs.length) {
            playMusic(songs[index + 1]);
        }
    });

    volumeInput.addEventListener("input", (e) => {
        const value = parseFloat(e.target.value);
        currentSong.volume = value;
        lastVolume = value;
        volumeIcon.src = value === 0 ? "Icons/mute.svg" : "Icons/volume.svg";
    });

    document.querySelector(".volume-toggle").addEventListener("click", () => {
        if (volumeIcon.src.includes("volume.svg")) {
            lastVolume = parseFloat(volumeInput.value) || 0.5;
            volumeIcon.src = "Icons/mute.svg";
            currentSong.volume = 0;
            volumeInput.value = "0";
        } else {
            volumeIcon.src = "Icons/volume.svg";
            volumeInput.value = String(lastVolume);
            currentSong.volume = lastVolume;
        }
    });
}

main().catch((err) => {
    console.error("Failed to start player. Use Live Server to open this project.", err);
});
