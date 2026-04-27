const roomtypeMap = {
    1: "ENEMY",
    2: "ELITE",
    3: "BOSS",
    4: "TREASURE",
    5: "SHOP",
    6: "EVENT",
    7: "REST"
};

const USELESS_PREFIX = [
    "STRIKE", "DEFEND", "ASCENDERS_BANE",
    "BAD_LUCK", "CLUMSY", "CURSE_OF_THE_BELL", "DEBT", "DECAY", "GREED", "GUILTY", "INJURY", "NORMALITY",
    "POOR_SLEEP", "REGRET", "SHAME", "SPORE_MIND", "WRITHE", "SPOILS_MAP", "BYRDONIS_EGG", "LANTERN_KEY"
];

const select = document.getElementById("playerSelect");
const data = rundata;
let currentPlayerIndex = 0;
let turnTimeline; 
let hpTimeline;
let goldTimeline;
let deckTimeline;

function analyzeSummary(player) {
    const killedBy =
        data.killed_by_event.Entry === "NONE"
            ? data.killed_by_encounter.Entry
            : data.killed_by_event.Entry;
    return {
        character: player.character.Entry,
        ascension: data.ascension,
        win: data.win,
        playTime: data.run_time,
        seed: data.seed,
        killedByEvent: killedBy
    };
}

function analyzeDeck(deck) {
    const count = {};

    deck.forEach(card => {
        let name = card.id.Entry;
        if (name.startsWith("STRIKE_")) name = "STRIKE";
        if (name.startsWith("DEFEND_")) name = "DEFEND";
        if (!count[name]) {
            count[name] = {
                total: 0,
                upgraded: 0
            };
        }

        count[name].total += 1;

        if (card.current_upgrade_level > 0) {
            count[name].upgraded += 1;
        }
    });

    return count;
}

function analyzeGold(currentPlayerIndex) {
    const timeline = [];
    const points = analyzeInfos(data);
    let globalFloor = 1;

    points.forEach(({ point, act, floorInAct, type, roomType }) => {
        const stats = point.player_stats[currentPlayerIndex];

        timeline.push({
            act,
            floorInAct,
            floor: globalFloor++,
            type,
            roomType,
            gold: stats.current_gold
        });
    });

    return timeline;
}

function analyzeHp(currentPlayerIndex) {
    const timeline = [];
    const points = analyzeInfos(data);
    let globalFloor = 1;

    points.forEach(({ point, act, floorInAct, type, roomType }) => {
        const stats = point.player_stats[currentPlayerIndex];

        timeline.push({
            act,
            floorInAct,
            floor: globalFloor++,
            type,
            roomType,
            hp: stats.current_hp,
            max_hp: stats.max_hp
        });
    });

    return timeline;
}

function analyzeTurn() {
    const timeline = [];
    const points = analyzeInfos(data);
    let globalFloor = 1;

    points.forEach(({ point, act, floorInAct, type, roomType }) => {
        const room = point.rooms?.[0];

        timeline.push({
            act,
            floorInAct,
            floor: globalFloor++,
            type,
            roomType,
            turn: room?.turns_taken ?? 0
        });
    });

    return timeline;
}

function analyzeDeckSize(currentPlayerIndex) {
    const reversedTimeline = [];

    let deckSize = data.players[currentPlayerIndex].deck.length;
    let uselessDeckSize = getInitialUselessCount(data.players[currentPlayerIndex].deck);

    const points = analyzeInfos(data).reverse();

    points.forEach(({ point, act, floorInAct, type, roomType }) => {
        const stats = point.player_stats[currentPlayerIndex];

        reversedTimeline.push({
            act,
            floorInAct,
            type,
            roomType,
            deckSize,
            uselessDeckSize
        });

        (stats.cards_gained || []).forEach(card => {
            const entry = card.id.Entry;
            deckSize -= 1;

            if (isUseless(entry)) {
                uselessDeckSize -= 1;
            }
        });

        (stats.cards_removed || []).forEach(card => {
            const entry = card.id.Entry;
            deckSize += 1;

            if (isUseless(entry)) {
                uselessDeckSize += 1;
            }
        });

        (stats.cards_transformed || []).forEach(tr => {
            const original = tr.original_card.id.Entry;
            const final = tr.final_card.id.Entry;

            if (isUseless(final)) uselessDeckSize -= 1;
            if (isUseless(original)) uselessDeckSize += 1;
        });
    });

    return reversedTimeline.reverse().map((t, i) => ({
        ...t,
        floor: i + 1
    }));
}

// ==========================================================================
function renderSummary(summary) {
    const el = document.getElementById("summary");

    el.innerHTML = `
    <h2>Infos</h2>
    Character: ${summary.character} <br>
    Ascension: ${summary.ascension} <br>
    Result: ${summary.win ? "Victory" : "Defeat"} <br>
    Play Time: ${summary.playTime} seconds <br>
    Seed: ${summary.seed} <br>
    Defeated at: ${summary.killedByEvent}
  `;
}

function renderDeck(deckAnalysis) {
    const el = document.getElementById("deck");

    let html = "<h2>Final Deck</h2>";

    for (const card in deckAnalysis) {
        const info = deckAnalysis[card];
        let upgrade = '';
        if (info.upgraded > 0) {
            upgrade = ` (upgrade #${info.upgraded})`;
        }
        html += `${card} #${info.total}${upgrade}<br>`;
    }

    el.innerHTML = html;
}

let turnChart, hpChart, goldChart, deckChart;

function renderGoldChart(timeline) {
    const ctx = document.getElementById("goldChart");

    if (goldChart) goldChart.destroy();
    goldChart = createLineChart(
        ctx,
        timeline.map(t => `# ${t.floor}`),
        [
            {
                label: "Gold",
                data: timeline.map(t => t.gold),
            }
        ],
        createTooltipCallbacks(timeline)
    );
}

function renderHpChart(timeline) {
    const ctx = document.getElementById("hpChart");

    if (hpChart) hpChart.destroy();
    hpChart = createLineChart(
        ctx,
        timeline.map(t => `# ${t.floor}`),
        [
            {
                label: "HP",
                data: timeline.map(t => t.hp),
            },
            {
                label: "Max HP",
                data: timeline.map(t => t.max_hp),
            }
        ],
        createTooltipCallbacks(timeline)
    );
}

function renderTurnChart(timeline) {
    const ctx = document.getElementById("turnChart");
    if (turnChart) turnChart.destroy();
    turnChart = createLineChart(
        ctx,
        timeline.map(t => `# ${t.floor}`),
        [
            {
                label: "Turn",
                data: timeline.map(t => t.turn),
            }
        ],
        createTooltipCallbacks(timeline),
        "bar"
    );
}

function renderDeckChart(timeline) {
    const ctx = document.getElementById("deckChart");
    if (deckChart) deckChart.destroy();
    deckChart = createLineChart(
        ctx,
        timeline.map(t => `# ${t.floor}`),
        [
            {
                label: "Deck Size",
                data: timeline.map(t => t.deckSize),
            },
            {
                label: "Base cards + Curses",
                data: timeline.map(t => t.uselessDeckSize),
            }
        ],
        createTooltipCallbacks(timeline),
        "bar"
    );
}

// ==========================================================================
function createLineChart(ctx, labels, datasets, tooltipCallbacks, type = "line") {
    return new Chart(ctx, {
        type: type,
        data: {
            labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: tooltipCallbacks
                }
            }
        }
    });
}

function createTooltipCallbacks(timeline) {
    return {
        afterBody: function (context) {
            const index = context[0].dataIndex;
            const t = timeline[index];
            let result = `${roomtypeMap[t.type]}: ${t.roomType}`;
            if (t.roomType === "NONE") {
                result = `${roomtypeMap[t.type]}`;
            }
            return result;
        }
    };
}

function analyzeInfos(data) {
    const result = [];

    data.map_point_history.forEach((act, actIndex) => {
        act.forEach((point, floorIndex) => {
            result.push({
                point,
                act: actIndex + 1,
                floorInAct: floorIndex + 1,
                type: point.rooms[0].room_type,
                roomType: point.rooms[0].model_id?.Entry || "NONE"
            });
        });
    });

    return result;
}

function filterAct(timeline, act) {
    return timeline.filter(t => t.act === act);
}

function renderCharts(act) {
    const filteredTurn = filterAct(turnTimeline, act);
    const filteredHp = filterAct(hpTimeline, act);
    const filteredGold = filterAct(goldTimeline, act);
    const filteredDeck = filterAct(deckTimeline, act);

    renderTurnChart(filteredTurn);
    renderHpChart(filteredHp);
    renderGoldChart(filteredGold);
    renderDeckChart(filteredDeck);
}

function isUseless(cardEntry) {
    return USELESS_PREFIX.some(prefix => cardEntry.startsWith(prefix));
}

function getInitialUselessCount(deck) {
    return deck.filter(card =>
        isUseless(card.id.Entry)
    ).length;
}

// ==========================================================================

rundata.players.forEach((p, i) => {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `Player ${i + 1}`;
    select.appendChild(option);
});

select.addEventListener("change", (e) => {
    currentPlayerIndex = Number(e.target.value) || 0;
    computeAll(currentPlayerIndex);
});

document.getElementById("actButtons").addEventListener("click", (e) => {
    const act = parseInt(e.target.getAttribute("data-act"));
    renderCharts(act, currentPlayerIndex);
});

function computeAll(currentPlayerIndex) {
    const player = data.players[currentPlayerIndex];

    turnTimeline = analyzeTurn();
    hpTimeline = analyzeHp(currentPlayerIndex);
    goldTimeline = analyzeGold(currentPlayerIndex);
    deckTimeline = analyzeDeckSize(currentPlayerIndex);

    const summary = analyzeSummary(player);
    const deckAnalysis = analyzeDeck(player.deck);

    renderSummary(summary);
    renderDeck(deckAnalysis);

    renderCharts(1, currentPlayerIndex);
}

computeAll(0);