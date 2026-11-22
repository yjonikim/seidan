#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dlr.py — Da Liu Ren (大六壬) board caster · seidan toolkit
===========================================================

Casts a full DLR board from a moment: day pillar + xun voids, hour branch
(true solar time by default), yue jiang (月将) from solar longitude,
heaven/earth plates, four lessons (四课), course-type cascade (课体),
three transmissions (三传) with hidden stems (遁干) and the twelve
generals (十二天将), plus optional benming/xingnian (本命/行年) overlays.

Pure Python 3, stdlib only. No ephemeris files needed (built-in solar
longitude good to ~0.01°, way more than enough for 30° yue jiang bins).

USAGE
    python3 dlr.py YYYY-MM-DD HH:MM UTC_OFFSET LAT LON [options]

    UTC_OFFSET = the CLOCK offset in effect (PDT = -7, EDT = -4, KST = +9)
    LAT        = accepted for signature parity with chart.js (unused)
    LON        = east-positive degrees (LIC ≈ -73.95, Thousand Oaks ≈ -118.84)

OPTIONS
    --birth YYYY        birth year → benming (本命, birth-year branch)
    --gender f|m        with --birth, computes xingnian (行年):
                        m: starts 寅 at xu-age 1, counts forward
                        f: starts 申 at xu-age 1, counts backward
    --no-solar          use clock time for the hour branch (default: true
                        solar time = clock + longitude offset + equation
                        of time; both times are always printed)
    --guiren a|b        noble-man day/night table (default a):
                        a: day 甲丑 乙子 丙亥 丁亥 戊丑 己子 庚丑 辛午 壬巳 癸巳
                           (the scheme used by the inaugural Oct 18, 2026 cast)
                        b: day 甲未 乙申 丙酉 丁亥 戊丑 己子 庚丑 辛寅 壬卯 癸巳
                           (the other common school; night = mirror pair)
    --day-boundary midnight|zishi
                        when the day pillar flips (default midnight;
                        zishi flips at 23:00 local)
    --question "..."    echo the question onto the printout
    --selftest          validate the engine against the Oct 18, 2026
                        inaugural board and exit

CONVENTIONS / SCHOOLS (documented so future instances don't re-litigate)
    · Yue jiang by solar longitude (zhongqi boundaries): sun-in-Libra → 辰, etc.
    · Day/night for the noble man: hour branch 卯–申 = day, 酉–寅 = night.
    · Guiren rotation: seat on earth plate 亥..辰 → forward, 巳..戌 → reverse.
    · Duplicate lessons are deduped before strike-counting (不备 counts once).
    · She-hai depth: from the candidate's earth-plate seat, step FORWARD to
      its home branch (both ends inclusive), counting branch qi + lodged
      stems (寄宫干) that strike it (for zei) / that it strikes (for ke).
      Ties → seat on a meng branch (寅申巳亥) wins, then zhong (子午卯酉),
      then yang-day takes the stem-top lesson / yin-day the branch-top.
    · Fuyin: strike if present, else yang-day stem-top / yin-day branch-top;
      middle = xing of initial (self-xing → other top), final = xing of middle
      (self-xing → chong).
    · Fanyin with no strike: initial = day branch's yi-ma (驿马),
      middle = branch-top, final = stem-top.
    · Timing frame (the convention delivered with the first cast): the board
      answers ~90 days from the asking; the three transmissions are ordinal
      phases (not equal thirds); triggers tend to land on days matching the
      transmission branches; voids fill when the xun turns.

Reading rules live in the reader's head, not here — this prints the board
and the derivation, with EN glosses throughout (no hanzi literacy assumed).
"""

import sys, math, datetime

# ---------------------------------------------------------------- tables ---

STEMS    = "甲乙丙丁戊己庚辛壬癸"
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"

STEM_PY   = ["jia","yi","bing","ding","wu","ji","geng","xin","ren","gui"]
BRANCH_PY = ["zi","chou","yin","mao","chen","si","wu","wei","shen","you","xu","hai"]
BRANCH_AN = ["Rat","Ox","Tiger","Rabbit","Dragon","Snake","Horse","Goat",
             "Monkey","Rooster","Dog","Pig"]

ELEMS = ["wood","fire","earth","metal","water"]
STEM_ELEM   = [0,0,1,1,2,2,3,3,4,4]            # by stem index
BRANCH_ELEM = [4,2,0,0,2,1,1,2,3,3,2,4]        # by branch index

def kes(a, b):      # element a strikes element b?  wood>earth>water>fire>metal>wood
    return (a - b) % 5 == 3
def gens(a, b):     # element a generates element b?
    return (b - a) % 5 == 1

JIGONG = {0:2, 1:4, 2:5, 3:7, 4:5, 5:7, 6:8, 7:10, 8:11, 9:1}   # stem → lodged branch
LODGED = {}                                                      # branch → [stems]
for s, b in JIGONG.items():
    LODGED.setdefault(b, []).append(s)

COMBINE = {0:5, 5:0, 1:6, 6:1, 2:7, 7:2, 3:8, 8:3, 4:9, 9:4}    # stem five-combines

XING  = {0:3, 3:0, 2:5, 5:8, 8:2, 1:10, 10:7, 7:1, 4:4, 6:6, 9:9, 11:11}
SELF_XING = {4, 6, 9, 11}
def chong(b): return (b + 6) % 12
YIMA = {0:2, 4:2, 8:2,  1:11, 5:11, 9:11,  2:8, 6:8, 10:8,  3:5, 7:5, 11:5}

MENG  = {2, 8, 5, 11}   # 寅申巳亥
ZHONG = {0, 6, 3, 9}    # 子午卯酉

YJ_NAME = {0:"神后 Shenhou", 1:"大吉 Daji", 2:"功曹 Gongcao", 3:"太冲 Taichong",
           4:"天罡 Tiangang", 5:"太乙 Taiyi", 6:"胜光 Shengguang", 7:"小吉 Xiaoji",
           8:"传送 Chuansong", 9:"从魁 Congkui", 10:"河魁 Hekui", 11:"登明 Dengming"}

GENERALS = [
    ("贵人","Guiren","Noble Man"),       ("螣蛇","Tengshe","Coiling Snake"),
    ("朱雀","Zhuque","Vermilion Bird"),  ("六合","Liuhe","Harmony"),
    ("勾陈","Gouchen","Hooked Array"),   ("青龙","Qinglong","Azure Dragon"),
    ("天空","Tiankong","Empty Sky"),     ("白虎","Baihu","White Tiger"),
    ("太常","Taichang","Constancy"),     ("玄武","Xuanwu","Dark Warrior"),
    ("太陰","Taiyin","Great Yin"),       ("天后","Tianhou","Celestial Empress"),
]

# guiren day/night tables, by stem index                      (see header)
GUIREN = {
    "a": {"day":   [1,0,11,11,1,0,1,6,5,5],
          "night": [7,8,9,9,7,8,7,2,3,3]},
    "b": {"day":   [7,8,9,11,1,0,1,2,3,5],
          "night": [1,0,11,9,7,8,7,6,5,3]},
}

SIX_REL = {  # relation of a branch's element to the day stem's element
    "peer":     "兄弟 Peers (same element)",
    "resource": "父母 Resource (generates the day stem)",
    "output":   "子孙 Output (the day stem generates it)",
    "wealth":   "妻财 Wealth (the day stem strikes it)",
    "officer":  "官鬼 Officer/Ghost (it strikes the day stem)",
}
def six_rel(branch, stem):
    be, se = BRANCH_ELEM[branch], STEM_ELEM[stem]
    if be == se:        return SIX_REL["peer"]
    if gens(be, se):    return SIX_REL["resource"]
    if gens(se, be):    return SIX_REL["output"]
    if kes(se, be):     return SIX_REL["wealth"]
    return SIX_REL["officer"]

def S(i):  return "%s %s" % (STEMS[i], STEM_PY[i])
def B(i):  return "%s %s (%s, %s)" % (BRANCHES[i], BRANCH_PY[i], BRANCH_AN[i], ELEMS[BRANCH_ELEM[i]])
def Bs(i): return "%s %s" % (BRANCHES[i], BRANCH_PY[i])

# ------------------------------------------------------- astronomy (sun) ---

def jd_from_utc(dt):
    y, m = dt.year, dt.month
    d = dt.day + (dt.hour + dt.minute/60 + dt.second/3600) / 24
    if m <= 2: y -= 1; m += 12
    a = y // 100
    b = 2 - a + a // 4
    return int(365.25*(y+4716)) + int(30.6001*(m+1)) + d + b - 1524.5

def sun_longitude(jd):
    T  = (jd - 2451545.0) / 36525.0
    L0 = 280.46646 + 36000.76983*T + 0.0003032*T*T
    M  = math.radians(357.52911 + 35999.05029*T - 0.0001537*T*T)
    C  = ((1.914602 - 0.004817*T - 0.000014*T*T)*math.sin(M)
          + (0.019993 - 0.000101*T)*math.sin(2*M)
          + 0.000289*math.sin(3*M))
    lam = L0 + C - 0.00569 - 0.00478*math.sin(math.radians(125.04 - 1934.136*T))
    return lam % 360.0

def equation_of_time_min(jd):
    T  = (jd - 2451545.0) / 36525.0
    L0 = math.radians((280.46646 + 36000.76983*T) % 360)
    M  = math.radians(357.52911 + 35999.05029*T)
    e  = 0.016708634 - 0.000042037*T
    eps = math.radians(23.439291 - 0.0130042*T)
    y  = math.tan(eps/2)**2
    E  = (y*math.sin(2*L0) - 2*e*math.sin(M) + 4*e*y*math.sin(M)*math.cos(2*L0)
          - 0.5*y*y*math.sin(4*L0) - 1.25*e*e*math.sin(2*M))
    return math.degrees(E) * 4.0

# -------------------------------------------------------------- calendar ---

ANCHOR = (datetime.date(2026, 10, 18), 1)   # 乙丑, validated vs the Oct 18 cast

def day_index(d):
    return (ANCHOR[1] + (d - ANCHOR[0]).days) % 60

def year_pillar(y):
    i = (y - 4) % 60
    return i % 10, i % 12

def xun_info(di):
    start = (di // 10) * 10
    sb = start % 12
    hidden = {}
    for i in range(10):
        hidden[(sb + i) % 12] = (start + i) % 10
    voids = ((sb + 10) % 12, (sb + 11) % 12)
    return hidden, voids

# ------------------------------------------------------------ the engine ---

class Board:
    pass

def cast(date, clock_hm, utc_off, lon, use_solar=True,
         guiren_scheme="a", day_boundary="midnight"):
    bd = Board()
    hh, mm = clock_hm
    local = datetime.datetime(date.year, date.month, date.day, hh, mm)
    utc = local - datetime.timedelta(hours=utc_off)
    jd  = jd_from_utc(utc)

    lam = sun_longitude(jd)
    eot = equation_of_time_min(jd)
    solar = utc + datetime.timedelta(hours=lon/15.0, minutes=eot)
    used = solar if use_solar else local

    bd.local, bd.solar, bd.used, bd.eot, bd.lam = local, solar, used, eot, lam
    bd.use_solar = use_solar

    # hour branch
    h = used.hour + used.minute/60.0
    bd.hour = int(((h + 1) % 24) // 2)

    # day pillar date (23:00+ rolls forward under zishi boundary)
    pd = used.date()
    if day_boundary == "zishi" and used.hour >= 23:
        pd = pd + datetime.timedelta(days=1)
    bd.di = day_index(pd)
    bd.dstem, bd.dbranch = bd.di % 10, bd.di % 12
    bd.hidden, bd.voids = xun_info(bd.di)
    bd.yang_day = (bd.dstem % 2 == 0)

    # yue jiang & plates
    bd.yj = (10 - int(lam // 30)) % 12
    bd.shift = (bd.yj - bd.hour) % 12
    heaven = lambda e: (e + bd.shift) % 12          # heaven branch over earth e
    seat   = lambda x: (x - bd.shift) % 12          # earth seat of heaven branch x
    bd.heaven, bd.seat = heaven, seat

    # four lessons: (top heaven branch, bottom label, bottom element)
    jg = JIGONG[bd.dstem]
    k1 = (heaven(jg),        None)          # bottom = day stem
    k2 = (heaven(k1[0]),     k1[0])
    k3 = (heaven(bd.dbranch), bd.dbranch)
    k4 = (heaven(k3[0]),     k3[0])
    bd.lessons = [k1, k2, k3, k4]

    def bottom_elem(l):
        return STEM_ELEM[bd.dstem] if l[1] is None else BRANCH_ELEM[l[1]]

    # dedupe identical lessons for strike counting (不备)
    uniq, seen = [], set()
    for l in bd.lessons:
        key = (l[0], "stem" if l[1] is None else l[1])
        if key not in seen:
            seen.add(key); uniq.append(l)

    zei = [l for l in uniq if kes(bottom_elem(l), BRANCH_ELEM[l[0]])]
    ke  = [l for l in uniq if kes(BRANCH_ELEM[l[0]], bottom_elem(l))]

    bd.notes = []
    stem_parity = bd.dstem % 2

    def parity_filter(cands):
        hit = [l for l in cands if l[0] % 2 == stem_parity]
        return hit if len(hit) >= 1 else cands

    def shehai_depth(l, received):
        x = l[0]; s0 = seat(x); depth = 0; p = s0
        while True:
            victims = [("branch", BRANCH_ELEM[p])] + \
                      [("stem", STEM_ELEM[st]) for st in LODGED.get(p, [])]
            for _, e in victims:
                if received and kes(e, BRANCH_ELEM[x]): depth += 1
                if (not received) and kes(BRANCH_ELEM[x], e): depth += 1
            if p == x: break
            p = (p + 1) % 12
        return depth

    def shehai_pick(cands, received):
        depths = [(shehai_depth(l, received), l) for l in cands]
        mx = max(d for d, _ in depths)
        top = [l for d, l in depths if d == mx]
        if len(top) == 1:
            bd.notes.append("she-hai depth decided (depth %d)" % mx)
            return top[0], "涉害 Shehai (Wading Through Harm)"
        m = [l for l in top if seat(l[0]) in MENG]
        if len(m) == 1:
            bd.notes.append("she-hai tie → meng seat (见机)")
            return m[0], "涉害 Shehai · 见机 (meng-seat tiebreak)"
        z = [l for l in top if seat(l[0]) in ZHONG]
        if len(z) == 1:
            bd.notes.append("she-hai tie → zhong seat (察微)")
            return z[0], "涉害 Shehai · 察微 (zhong-seat tiebreak)"
        pick = k1 if bd.yang_day else k3
        bd.notes.append("she-hai unresolved → 复等: %s-day takes %s top"
                        % ("yang" if bd.yang_day else "yin",
                           "stem" if bd.yang_day else "branch"))
        return pick, "涉害 Shehai · 复等 (fallback)"

    def pick_from(cands, received, single_name):
        if len(cands) == 1:
            return cands[0], single_name
        filt = parity_filter(cands)
        if len(filt) == 1:
            return filt[0], "知一 Zhiyi (Knowing the One — parity pick)"
        return shehai_pick(filt, received)

    fuyin  = (bd.shift == 0)
    fanyin = (bd.shift == 6)
    initial = middle = final = None
    course = ""

    if fuyin:
        course = "伏吟 Fuyin (Hidden Hum — heaven plate sits on earth plate)"
        if zei:
            l, nm = pick_from(zei, True, "伏吟·有克 (strike present)")
            initial = l[0]
        elif ke:
            l, nm = pick_from(ke, False, "伏吟·有克 (strike present)")
            initial = l[0]
        else:
            initial = k1[0] if bd.yang_day else k3[0]
            course += " · 无克: " + ("自任 yang-day stem-top" if bd.yang_day
                                     else "自信 yin-day branch-top")
        if initial in SELF_XING:
            if initial == k1[0]:
                middle = k3[0]
            elif initial == k3[0]:
                middle = k1[0]
            else:
                middle = k3[0] if bd.yang_day else k1[0]
            bd.notes.append("fuyin: initial self-xing → middle takes the other lesson-top")
        else:
            middle = XING[initial]
        if middle in SELF_XING or XING.get(middle) == middle:
            final = chong(middle)
            bd.notes.append("fuyin: middle self-xing → final takes its chong")
        else:
            final = XING[middle]
            if final == initial:
                final = chong(middle)
                bd.notes.append("fuyin: xing loops back → final takes chong of middle")
    elif fanyin and not zei and not ke:
        course = "返吟 Fanyin (Returning Hum) · 无克 — initial = day branch's yi-ma"
        initial = YIMA[bd.dbranch]
        middle, final = k3[0], k1[0]
    else:
        if zei:
            l, course = pick_from(zei, True,
                                  "重审 Zhongshen (Re-examination — single lower-strikes-upper)")
            initial = l[0]
        elif ke:
            l, course = pick_from(ke, False,
                                  "元首 Yuanshou (Chief — single upper-strikes-lower)")
            initial = l[0]
        else:
            tops = []
            for l in (bd.lessons[1], bd.lessons[2], bd.lessons[3]):
                if l[0] not in [t[0] for t in tops]:
                    tops.append(l)
            shoot_in  = [l for l in tops if kes(BRANCH_ELEM[l[0]], STEM_ELEM[bd.dstem])]
            shoot_out = [l for l in tops if kes(STEM_ELEM[bd.dstem], BRANCH_ELEM[l[0]])]
            if shoot_in or shoot_out:
                cands = shoot_in if shoot_in else shoot_out
                kind = ("蒿矢 Haoshi (Arrow — top strikes the stem from afar)"
                        if shoot_in else
                        "弹射 Tanshe (Pellet — stem strikes a top from afar)")
                filt = parity_filter(cands)
                if len(filt) > 1:
                    m = [l for l in filt if seat(l[0]) in MENG] or \
                        [l for l in filt if seat(l[0]) in ZHONG] or filt
                    filt = m
                initial = filt[0][0]
                course = "遥克 Yaoke (Distant Strike) · " + kind
            else:
                distinct = len(seen)
                if distinct == 4:
                    course = "昴星 Maoxing (Pleiades — four full lessons, no strike)"
                    if bd.yang_day:
                        initial, middle, final = heaven(9), k3[0], k1[0]
                        course += " · 虎视 yang-day (heaven over earth 酉)"
                    else:
                        initial, middle, final = seat(9), k1[0], k3[0]
                        course += " · 冬蛇掩目 yin-day (earth under heaven 酉)"
                elif distinct == 3:
                    course = "别责 Biéze (Alternate Charge — three lessons, no strike)"
                    if bd.yang_day:
                        initial = heaven(JIGONG[COMBINE[bd.dstem]])
                        course += " · yang-day: top over combining stem's lodging"
                    else:
                        initial = (bd.dbranch + 4) % 12
                        course += " · yin-day: next branch of the day branch's trine"
                    middle = final = k1[0]
                else:
                    course = "八专 Bazhuan (Eight Concentrations — stem & branch share a palace)"
                    if bd.yang_day:
                        initial = (k1[0] + 2) % 12
                        course += " · yang-day: third forward from stem-top"
                    else:
                        initial = (k4[0] - 2) % 12
                        course += " · yin-day: third backward from fourth-lesson top"
                    middle = final = k1[0]
        if middle is None:
            middle = heaven(initial)
            final  = heaven(middle)
        if fanyin:
            course = "返吟 Fanyin (Returning Hum) · " + course

    bd.initial, bd.middle, bd.final, bd.course = initial, middle, final, course

    # twelve generals
    gday = "day" if 3 <= bd.hour <= 8 else "night"
    bd.gday = gday
    gui = GUIREN[guiren_scheme][gday][bd.dstem]
    gseat = seat(gui)
    fwd = gseat in (11, 0, 1, 2, 3, 4)
    bd.gui, bd.gseat, bd.gfwd, bd.gscheme = gui, gseat, fwd, guiren_scheme
    bd.gen_at_earth = {}
    for k in range(12):
        e = (gseat + k) % 12 if fwd else (gseat - k) % 12
        bd.gen_at_earth[e] = k
    bd.gen_on = lambda x: bd.gen_at_earth[seat(x)]
    return bd

# --------------------------------------------------------------- output ---

def fmt_general(k):
    g = GENERALS[k]
    return "%s %s (%s)" % (g[0], g[1], g[2])

def transmission_line(bd, label, x):
    hs = bd.hidden.get(x)
    hid = ("hidden stem %s" % S(hs)) if hs is not None else "VOID (空亡 — no hidden stem)"
    void = "  ◦VOID◦" if x in bd.voids else ""
    return "  %-7s %-28s %s · %s\n           %s%s" % (
        label, B(x), fmt_general(bd.gen_on(x)), six_rel(x, bd.dstem), hid, void)

def pattern_notes(bd):
    t = {bd.initial, bd.middle, bd.final}
    out = []
    if t == {1, 10, 7}: out.append("三传 form the 丑戌未 three-punishment (bullying xing)")
    if t == {2, 5, 8}:  out.append("三传 form the 寅巳申 three-punishment (ungrateful xing)")
    for trine, el in (({8,0,4},"water"), ({2,6,10},"fire"), ({11,3,7},"wood"), ({5,9,1},"metal")):
        if t == trine: out.append("三传 form the %s trine (三合局)" % el)
    elems = {BRANCH_ELEM[x] for x in (bd.initial, bd.middle, bd.final)}
    if len(elems) == 1:
        out.append("all three transmissions are %s" % ELEMS[elems.pop()])
    return out

def render(bd, question=None, benming=None, xingnian=None, xingnian_note=""):
    o = []
    A = o.append
    A("=" * 64)
    A("DA LIU REN 大六壬 · seidan toolkit")
    if question: A("Q: %s" % question)
    A("-" * 64)
    A("clock  %s   true solar  %s  (EoT %+0.1f min)" % (
        bd.local.strftime("%Y-%m-%d %H:%M"), bd.solar.strftime("%Y-%m-%d %H:%M"), bd.eot))
    A("hour branch from %s time" % ("TRUE SOLAR" if bd.use_solar else "CLOCK"))
    A("sun λ %.2f° → yue jiang 月将 = %s [%s]" % (bd.lam, B(bd.yj), YJ_NAME[bd.yj]))
    A("day pillar  %s%s (%s-%s) · %s day · xun voids 空亡: %s, %s" % (
        STEMS[bd.dstem], BRANCHES[bd.dbranch], STEM_PY[bd.dstem], BRANCH_PY[bd.dbranch],
        "yang" if bd.yang_day else "yin", Bs(bd.voids[0]), Bs(bd.voids[1])))
    A("hour 时: %s · noble man rotation: %s (%s hours, scheme %s, 贵人 %s on earth %s)" % (
        Bs(bd.hour), "forward" if bd.gfwd else "reverse", bd.gday,
        bd.gscheme.upper(), Bs(bd.gui), Bs(bd.gseat)))
    A("-" * 64)
    A("PLATES (earth → heaven above it → general riding there)")
    jg = JIGONG[bd.dstem]
    for e in range(12):
        h = bd.heaven(e)
        marks = []
        if e == jg:         marks.append("◄ day-stem lodging")
        if e == bd.dbranch: marks.append("◄ day branch")
        if h in bd.voids:   marks.append("void above")
        A("  %s │ %s │ %-24s %s" % (BRANCHES[e], BRANCHES[h],
                                     fmt_general(bd.gen_at_earth[e]),
                                     " ".join(marks)))
    A("-" * 64)
    A("FOUR LESSONS 四课 (top over bottom; K1 = over the day stem)")
    labels = ["K1", "K2", "K3", "K4"]
    for i, l in enumerate(bd.lessons):
        bot = S(bd.dstem) + " (day stem)" if l[1] is None else Bs(l[1])
        be  = STEM_ELEM[bd.dstem] if l[1] is None else BRANCH_ELEM[l[1]]
        te  = BRANCH_ELEM[l[0]]
        rel = ""
        if kes(be, te): rel = "  ◄ lower strikes upper (贼)"
        elif kes(te, be): rel = "  ◄ upper strikes lower (克)"
        A("  %s: %s over %s%s" % (labels[i], Bs(l[0]), bot, rel))
    A("-" * 64)
    A("COURSE 课体: %s" % bd.course)
    for n in bd.notes: A("  · %s" % n)
    A("")
    A("THREE TRANSMISSIONS 三传")
    A(transmission_line(bd, "initial", bd.initial))
    A(transmission_line(bd, "middle",  bd.middle))
    A(transmission_line(bd, "final",   bd.final))
    pats = pattern_notes(bd)
    for p in pats: A("  ★ %s" % p)
    if benming is not None or xingnian is not None:
        A("-" * 64)
        A("YEAR-FATE OVERLAYS 年命")
        if benming is not None:
            A("  benming 本命 %s → topped by %s · %s" % (
                Bs(benming), Bs(bd.heaven(benming)), fmt_general(bd.gen_at_earth[benming])))
        if xingnian is not None:
            A("  xingnian 行年 %s%s → topped by %s · %s" % (
                Bs(xingnian), xingnian_note, Bs(bd.heaven(xingnian)),
                fmt_general(bd.gen_at_earth[xingnian])))
    A("-" * 64)
    A("frame: ~90 days from the asking · transmissions are ordinal phases ·")
    A("triggers favor days matching transmission branches · voids fill at xun turn")
    A("=" * 64)
    return "\n".join(o)

# -------------------------------------------------------------- selftest ---

def selftest():
    """Validate against the inaugural Oct 18, 2026 cast (Thousand Oaks)."""
    bd = cast(datetime.date(2026, 10, 18), (14, 17), -7.0, -118.8376)
    checks = [
        ("day pillar 乙丑",   (bd.dstem, bd.dbranch) == (1, 1)),
        ("hour 未",           bd.hour == 7),
        ("yue jiang 辰",      bd.yj == 4),
        ("voids 戌亥",        set(bd.voids) == {10, 11}),
        ("course zhongshen",  "重审" in bd.course),
        ("三传 丑戌未",        (bd.initial, bd.middle, bd.final) == (1, 10, 7)),
        ("day guiren, fwd",   bd.gday == "day" and bd.gfwd),
        ("蛇 rides 丑",        bd.gen_on(1) == 1),
        ("白虎 rides 未",      bd.gen_on(7) == 7),
        ("青龙 rides 巳",      bd.gen_on(5) == 5),
        ("太陰 rides 戌",      bd.gen_on(10) == 10),
        ("benming 辰 top 丑",  bd.heaven(4) == 1 and bd.gen_at_earth[4] == 1),
        ("xingnian 午 top 卯·六合", bd.heaven(6) == 3 and bd.gen_at_earth[6] == 3),
        ("中传 戌 is void",     bd.middle in bd.voids),
        ("hidden stems 乙丑/—/辛未",
            bd.hidden.get(1) == 1 and bd.hidden.get(10) is None and bd.hidden.get(7) == 7),
    ]
    ok = True
    for name, passed in checks:
        print("  [%s] %s" % ("ok" if passed else "FAIL", name))
        ok = ok and passed
    print("selftest:", "ALL PASS" if ok else "FAILURES — do not trust output")
    return 0 if ok else 1

# ------------------------------------------------------------------ main ---

def main(argv):
    pos, opts = [], {}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--selftest":
            return selftest()
        if a.startswith("--"):
            key = a[2:]
            if key in ("no-solar",):
                opts[key] = True; i += 1
            else:
                opts[key] = argv[i+1]; i += 2
        else:
            pos.append(a); i += 1
    if len(pos) < 5:
        print(__doc__); return 1

    date = datetime.date(*map(int, pos[0].split("-")))
    hh, mm = map(int, pos[1].split(":"))
    utc_off = float(pos[2])
    lon = float(pos[4])     # pos[3] = lat, unused

    bd = cast(date, (hh, mm), utc_off, lon,
              use_solar=not opts.get("no-solar", False),
              guiren_scheme=opts.get("guiren", "a").lower(),
              day_boundary=opts.get("day-boundary", "midnight"))

    benming = xingnian = None
    xn_note = ""
    if "birth" in opts:
        by = int(opts["birth"])
        benming = (by - 4) % 12
        g = opts.get("gender", "").lower()
        if g in ("f", "m"):
            xu = date.year - by + 1
            if g == "m":
                xingnian = (2 + (xu - 1)) % 12
                xn_note = " (male, forward from 寅, xu-age %d)" % xu
            else:
                xingnian = (8 - (xu - 1)) % 12
                xn_note = " (female, backward from 申, xu-age %d)" % xu

    print(render(bd, question=opts.get("question"),
                 benming=benming, xingnian=xingnian, xingnian_note=xn_note))
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
