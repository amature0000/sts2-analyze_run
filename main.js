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

function analyzeSummary(data) {
    const killedBy =
        data.killed_by_event.Entry === "NONE"
            ? data.killed_by_encounter.Entry
            : data.killed_by_event.Entry;
    return {
        character: data.players[0].character.Entry,
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

function analyzeEvents(data) {
    const history = data.map_point_history;

    const events = [];

    history.forEach(floor => {
        floor.forEach(point => {
            point.rooms.forEach(room => {
                if (room.model_id.Category === "EVENT") {
                    events.push(room.model_id.Entry);
                }
            });
        });
    });

    return events;
}

function analyzeGold(data) {
    const timeline = [];
    const points = analyzeInfos(data);
    let globalFloor = 1;

    points.forEach(({ point, act, floorInAct, type, roomType }) => {
        const stats = point.player_stats[0];

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

function analyzeHp(data) {
    const timeline = [];
    const points = analyzeInfos(data);
    let globalFloor = 1;

    points.forEach(({ point, act, floorInAct, type, roomType }) => {
        const stats = point.player_stats[0];

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

function analyzeTurn(data) {
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

function analyzeDeckSize(data) {
    const reversedTimeline = [];

    let deckSize = data.players[0].deck.length;
    let uselessDeckSize = getInitialUselessCount(data.players[0].deck);

    const points = analyzeInfos(data).reverse();

    points.forEach(({ point, act, floorInAct, type, roomType }) => {
        const stats = point.player_stats[0];

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

function renderSummary(summary) {
    const el = document.getElementById("summary");

    el.innerHTML = `
    <h2>요약</h2>
    캐릭터: ${summary.character} <br>
    결과: ${summary.win ? "승리" : "패배"} <br>
    플레이 시간: ${summary.playTime}초 <br>
    시드: ${summary.seed} <br>
    사망한 위치: ${summary.killedByEvent}
  `;
}

function renderDeck(deckAnalysis) {
    const el = document.getElementById("deck");

    let html = "<h2>최종 덱</h2>";

    for (const card in deckAnalysis) {
        const info = deckAnalysis[card];
        let upgrade = '';
        if (info.upgraded > 0) {
            upgrade = ` (강화 #${info.upgraded})`;
        }
        html += `${card} #${info.total}${upgrade}<br>`;
    }

    el.innerHTML = html;
}

function renderEvents(events) {
    const el = document.getElementById("events");

    el.innerHTML = `
    <h2>이벤트</h2>
    ${events.join("<br>")}
  `;
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
                label: "골드",
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
                label: "현재 HP",
                data: timeline.map(t => t.hp),
            },
            {
                label: "최대 HP",
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
                label: "턴",
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
                label: "덱 크기",
                data: timeline.map(t => t.deckSize),
            },
            {
                label: "타수+저주",
                data: timeline.map(t => t.uselessDeckSize),
            }
        ],
        createTooltipCallbacks(timeline),
        "bar"
    );
}

document.getElementById("actButtons").addEventListener("click", (e) => {
    const act = parseInt(e.target.getAttribute("data-act"));
    renderCharts(act);
});

// ==========================================================================
const data = rundata;
const player = data.players[0];

const summary = analyzeSummary(data);
const deckAnalysis = analyzeDeck(player.deck);
// const events = analyzeEvents(data);

renderSummary(summary);
renderDeck(deckAnalysis);
// renderEvents(events);
renderCharts(1);

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

            return `${roomtypeMap[t.type]}: ${t.roomType}`;
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
    const turnTimeline = analyzeTurn(data);
    const hpTimeline = analyzeHp(data);
    const goldTimeline = analyzeGold(data);
    const deckTimeline = analyzeDeckSize(data);
    console.log(deckTimeline);

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