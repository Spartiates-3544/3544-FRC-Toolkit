#!/usr/bin/env python3
"""3544 FRC Subsystem Generator — PyQt5 UI"""
import sys, os, re, glob

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_subsystem import (
    gen_subsystem, patch_robot_container,
    patch_constants, load_subsystem_config, validate_robot_wiring,
    delete_subsystem,
    SUBSYSTEMS_DIR, ROBOT_CONTAINER,
    MOTOR_TYPES, ENCODER_TYPES, encoder_is_absolute,
)

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QFormLayout, QLabel, QLineEdit, QComboBox, QSpinBox,
    QDoubleSpinBox, QCheckBox, QPushButton, QScrollArea, QFrame,
    QTextEdit, QSplitter, QMessageBox, QGroupBox, QSizePolicy,
    QStackedWidget, QTabBar,
)
from PyQt5.QtCore import Qt, pyqtSignal, QTimer
from PyQt5.QtGui import QFont, QColor, QPalette, QSyntaxHighlighter, QTextCharFormat

# ── Design tokens ─────────────────────────────────────────────────────────────
BG        = "#080808"
SURFACE   = "#12100f"
CARD      = "#1c1715"
BORDER    = "#3b2c24"
BORDER_HI = "#d4af37"
ACCENT    = "#8f1218"
ACCENT2   = "#d4af37"
GREEN     = "#7fd88f"
RED       = "#e2474f"
ORANGE    = "#c8802f"
YELLOW    = "#d4af37"
CYAN      = "#f2d77a"
TEXT      = "#f7f2e8"
TEXT_DIM  = "#d7c8aa"
MUTED     = "#8e7f6a"
INPUT_BG  = "#050505"
NAV_W     = 200

SS = f"""
* {{ font-family: 'Segoe UI', 'Inter', sans-serif; font-size: 13px; color: {TEXT}; }}
QMainWindow, QWidget {{ background: {BG}; }}
QScrollArea {{ border: none; background: transparent; }}
QScrollBar:vertical {{ background: {SURFACE}; width: 5px; border-radius: 2px; margin: 0; }}
QScrollBar::handle:vertical {{ background: {BORDER}; border-radius: 2px; min-height: 20px; }}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0; }}
QSplitter::handle {{ background: {BORDER}; }}
QToolTip {{ background: {CARD}; border: 1px solid {ACCENT}; color: {TEXT}; padding: 6px 10px; border-radius: 5px; font-size: 12px; }}

QGroupBox {{
    background: {SURFACE}; border: 1px solid {BORDER}; border-radius: 8px;
    margin-top: 20px; padding: 14px 12px 12px 12px;
    font-weight: 600; font-size: 12px; color: {ACCENT}; letter-spacing: 0.4px;
}}
QGroupBox::title {{
    subcontrol-origin: margin; left: 14px; padding: 0 6px;
    color: {ACCENT}; background: {SURFACE};
}}

QLineEdit, QSpinBox, QDoubleSpinBox, QComboBox {{
    background: {INPUT_BG}; border: 1px solid {BORDER}; border-radius: 5px;
    padding: 5px 9px; color: {TEXT}; selection-background-color: {ACCENT}; min-height: 22px;
}}
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus, QComboBox:focus {{
    border-color: {ACCENT2}; background: #0d0b0a;
}}
QLineEdit:hover, QSpinBox:hover, QDoubleSpinBox:hover, QComboBox:hover {{
    border-color: {BORDER_HI};
}}
QSpinBox::up-button, QSpinBox::down-button,
QDoubleSpinBox::up-button, QDoubleSpinBox::down-button {{
    width: 16px; border: none; background: #231614;
}}
QComboBox::drop-down {{ border: none; width: 22px; }}
QComboBox QAbstractItemView {{
    background: {CARD}; border: 1px solid {BORDER};
    selection-background-color: {ACCENT}; selection-color: {TEXT}; color: {TEXT}; outline: none;
}}
QCheckBox {{ spacing: 7px; color: {TEXT}; }}
QCheckBox::indicator {{
    width: 16px; height: 16px; border: 1px solid {BORDER}; border-radius: 4px; background: {INPUT_BG};
}}
QCheckBox::indicator:checked {{ background: {ACCENT}; border-color: {ACCENT}; }}
QCheckBox::indicator:hover {{ border-color: {ACCENT}; }}

QPushButton {{
    background: {CARD}; border: 1px solid {BORDER}; border-radius: 5px;
    padding: 6px 14px; color: {TEXT}; font-weight: 500;
}}
QPushButton:hover {{ background: {BORDER}; border-color: {ACCENT2}; }}
QPushButton:pressed {{ background: {ACCENT}; color: {TEXT}; }}

QPushButton#generate_btn {{
    background: qlineargradient(x1:0,y1:0,x2:1,y2:0,stop:0 #6f0e13,stop:0.55 {ACCENT},stop:1 #d4af37);
    color: #fffaf0; font-weight: 700; font-size: 14px;
    padding: 12px 28px; border: none; border-radius: 7px; letter-spacing: 0.4px;
}}
QPushButton#generate_btn:hover {{
    background: qlineargradient(x1:0,y1:0,x2:1,y2:0,stop:0 #9f1820,stop:0.55 #bd2029,stop:1 #f0c95a);
}}
QPushButton#generate_btn:pressed {{ background: #6f0e13; }}

QPushButton#add_btn {{
    background: transparent; border: 1px dashed {ACCENT2}; color: {ACCENT2};
    border-radius: 5px; padding: 4px 12px; font-size: 12px;
}}
QPushButton#add_btn:hover {{ background: #211707; border-style: solid; }}

QPushButton#rm_btn {{
    background: transparent; border: none; color: {MUTED}; font-size: 14px;
    font-weight: bold; min-width: 20px; max-width: 20px;
    min-height: 20px; max-height: 20px; border-radius: 10px; padding: 0;
}}
QPushButton#rm_btn:hover {{ color: {RED}; background: #26090c; }}

QPushButton#nav_btn {{
    background: transparent; border: none; border-radius: 6px;
    padding: 10px 14px; color: {TEXT_DIM}; font-size: 13px;
    text-align: left;
}}
QPushButton#nav_btn:hover {{ background: {CARD}; color: {TEXT}; }}
QPushButton#nav_btn[active="true"] {{
    background: {CARD}; color: {ACCENT}; border-left: 2px solid {ACCENT};
    font-weight: 600;
}}

QTextEdit {{
    background: #050505; border: 1px solid {BORDER}; border-radius: 6px; color: {TEXT};
    font-family: 'JetBrains Mono','Cascadia Code','Consolas',monospace;
    font-size: 12px; padding: 10px; line-height: 1.5;
}}

QFrame#motor_card {{
    background: {CARD}; border: 1px solid {BORDER}; border-radius: 7px;
}}
QFrame#motor_card[role="leader"] {{ border-color: {ACCENT}; }}
QFrame#state_pill {{ background: {INPUT_BG}; border: 1px solid {BORDER}; border-radius: 5px; }}
QFrame#subsystem_card {{
    background: {SURFACE}; border: 1px solid {BORDER}; border-radius: 8px;
}}
QFrame#subsystem_card:hover {{ border-color: {ACCENT}; }}
"""

# ── Syntax highlighter ────────────────────────────────────────────────────────
class JavaHighlighter(QSyntaxHighlighter):
    def __init__(self, doc):
        super().__init__(doc)
        def fmt(color, bold=False, italic=False):
            f = QTextCharFormat()
            f.setForeground(QColor(color))
            if bold:   f.setFontWeight(QFont.Bold)
            if italic: f.setFontItalic(True)
            return f
        self.rules = [
            (r'\b(public|private|final|void|class|new|return|this|if|else|switch|case|break|default|import|package|var|double|boolean|int|String|static)\b', fmt(RED, bold=True)),
            (r'"[^"\\]*(?:\\.[^"\\]*)*"', fmt(YELLOW)),
            (r'//[^\n]*',                 fmt(MUTED, italic=True)),
            (r'\b\d+\.?\d*\b',            fmt(ORANGE)),
            (r'\b[A-Z][A-Za-z0-9_]*\b',  fmt(CYAN)),
        ]

    def highlightBlock(self, text):
        for pattern, fmt in self.rules:
            for m in re.finditer(pattern, text):
                self.setFormat(m.start(), m.end() - m.start(), fmt)


# ── Widget helpers ────────────────────────────────────────────────────────────
def _lbl(text, muted=False, bold=False, size=None, color=None):
    w = QLabel(text)
    c = color or (MUTED if muted else TEXT)
    s = f"color:{c};"
    if bold:  s += "font-weight:600;"
    if size:  s += f"font-size:{size}px;"
    w.setStyleSheet(s)
    return w

def _field_col(label_text, widget, tooltip=None):
    col = QVBoxLayout()
    col.setSpacing(3)
    col.setContentsMargins(0, 0, 0, 0)
    lbl = QLabel(label_text)
    lbl.setStyleSheet(f"color:{MUTED}; font-size:10px; font-weight:600; letter-spacing:0.3px;")
    col.addWidget(lbl)
    col.addWidget(widget)
    if tooltip:
        widget.setToolTip(tooltip)
        lbl.setToolTip(tooltip)
    return col

def _sep():
    f = QFrame(); f.setFrameShape(QFrame.HLine)
    f.setStyleSheet(f"color:{BORDER}; background:{BORDER}; max-height:1px; margin:4px 0;")
    return f

class NoWheelComboBox(QComboBox):
    def wheelEvent(self, event):
        event.ignore()

class NoWheelSpinBox(QSpinBox):
    def wheelEvent(self, event):
        event.ignore()

class NoWheelDoubleSpinBox(QDoubleSpinBox):
    def wheelEvent(self, event):
        event.ignore()

def _rm_btn():
    b = QPushButton("✕"); b.setObjectName("rm_btn"); b.setToolTip("Remove")
    return b

def _connect_all(widget, slot):
    for c in widget.findChildren(QLineEdit):   c.textChanged.connect(slot)
    for c in widget.findChildren(QSpinBox):    c.valueChanged.connect(slot)
    for c in widget.findChildren(QDoubleSpinBox): c.valueChanged.connect(slot)
    for c in widget.findChildren(QComboBox):   c.currentIndexChanged.connect(slot)
    for c in widget.findChildren(QCheckBox):   c.stateChanged.connect(slot)


# ── Motor card ────────────────────────────────────────────────────────────────
class MotorCard(QFrame):
    removed = pyqtSignal(object)
    changed = pyqtSignal()

    def __init__(self, idx, parent=None):
        super().__init__(parent)
        self.idx = idx
        self.setObjectName("motor_card")
        self.setProperty("role", "leader" if idx == 0 else "follower")

        outer = QVBoxLayout(self)
        outer.setContentsMargins(12, 10, 10, 10)
        outer.setSpacing(8)

        row1 = QHBoxLayout(); row1.setSpacing(10)
        badge = QLabel("LEADER" if idx == 0 else f"FOLLOWER {idx}")
        badge.setFixedWidth(80); badge.setAlignment(Qt.AlignCenter)
        badge.setStyleSheet(
            f"background:{ACCENT}; color:{BG}; border-radius:4px; font-size:10px; font-weight:700; padding:2px 6px;"
            if idx == 0 else
            f"background:{CARD}; color:{MUTED}; border:1px solid {BORDER}; border-radius:4px; font-size:10px; font-weight:600; padding:2px 6px;"
        )
        row1.addWidget(badge)
        self.name_edit = QLineEdit("LeaderMotor" if idx == 0 else f"Follower{idx}")
        self.name_edit.setPlaceholderText("Motor name")
        self.name_edit.setToolTip("Java field name for this motor controller.\nBecomes the variable name in generated code.")
        row1.addWidget(self.name_edit, 1)
        if idx > 0:
            rb = _rm_btn(); rb.clicked.connect(lambda: self.removed.emit(self))
            row1.addWidget(rb)
        outer.addLayout(row1)

        row2 = QHBoxLayout(); row2.setSpacing(12)
        self.can_spin = NoWheelSpinBox(); self.can_spin.setRange(0, 62); self.can_spin.setValue(idx)
        row2.addLayout(_field_col("CAN ID", self.can_spin, "CAN bus device ID (set in Phoenix Tuner X or REV Hardware Client)."))
        self.pdh_spin = NoWheelSpinBox(); self.pdh_spin.setRange(0, 23); self.pdh_spin.setValue(idx)
        row2.addLayout(_field_col("PDH Ch", self.pdh_spin, "Power Distribution Hub channel for current monitoring."))
        self.inv_check = QCheckBox("Inverted")
        self.inv_check.setToolTip("Flip motor direction.\nFor followers: relative to the leader.")
        row2.addWidget(self.inv_check, alignment=Qt.AlignBottom)
        row2.addStretch()
        outer.addLayout(row2)
        _connect_all(self, self.changed)

    def data(self):
        return {
            "name": self.name_edit.text().strip() or f"Motor{self.idx+1}",
            "can_id": self.can_spin.value(),
            "pdh_ch": self.pdh_spin.value(),
            "inverted": self.inv_check.isChecked(),
        }


# ── Tunable row ───────────────────────────────────────────────────────────────
class TunableRow(QFrame):
    removed = pyqtSignal(object)
    changed = pyqtSignal()

    def __init__(self, key="kP", label="kP", default=0.0, step=0.01, parent=None):
        super().__init__(parent)
        row = QHBoxLayout(self)
        row.setContentsMargins(0, 2, 0, 2); row.setSpacing(8)

        self.key_edit = QLineEdit(key); self.key_edit.setFixedWidth(88)
        self.key_edit.setToolTip("NT key and Java constant name.\ne.g. 'kP' → /3544/Tunables/<Subsystem>/kP")
        self.lbl_edit = QLineEdit(label); self.lbl_edit.setFixedWidth(96)
        self.lbl_edit.setToolTip("Human-readable label shown on the dashboard.")
        self.def_spin = NoWheelDoubleSpinBox(); self.def_spin.setRange(-1e6,1e6); self.def_spin.setDecimals(5); self.def_spin.setValue(default); self.def_spin.setFixedWidth(100)
        self.def_spin.setToolTip("Initial value used before the dashboard overrides it.")
        self.step_spin = NoWheelDoubleSpinBox(); self.step_spin.setRange(1e-6,1e6); self.step_spin.setDecimals(5); self.step_spin.setValue(step); self.step_spin.setFixedWidth(88)
        self.step_spin.setToolTip("Dashboard slider increment.\ne.g. 100 for RPM, 0.001 for gains.")

        for txt, w in [("Key", self.key_edit), ("Label", self.lbl_edit), ("Default", self.def_spin), ("Step", self.step_spin)]:
            row.addLayout(_field_col(txt, w))

        rb = _rm_btn(); rb.clicked.connect(lambda: self.removed.emit(self))
        row.addWidget(rb, alignment=Qt.AlignBottom)
        row.addStretch()
        _connect_all(self, self.changed)

    def data(self):
        return {
            "key":     self.key_edit.text().strip() or "kP",
            "label":   self.lbl_edit.text().strip() or self.key_edit.text().strip(),
            "default": self.def_spin.value(),
            "step":    self.step_spin.value(),
        }


# ── State pill ────────────────────────────────────────────────────────────────
class StatePill(QFrame):
    removed = pyqtSignal(object)
    changed = pyqtSignal()

    def __init__(self, state="idle", parent=None):
        super().__init__(parent)
        self.setObjectName("state_pill")
        row = QHBoxLayout(self); row.setContentsMargins(8,4,4,4); row.setSpacing(4)
        self.edit = QLineEdit(state); self.edit.setFixedWidth(110); self.edit.setFrame(False)
        self.edit.setStyleSheet(f"background:transparent; border:none; color:{TEXT}; font-size:12px;")
        self.edit.setToolTip("State name used in setState(\"...\") calls.")
        self.edit.textChanged.connect(self.changed)
        rb = _rm_btn(); rb.setFixedSize(18,18); rb.clicked.connect(lambda: self.removed.emit(self))
        row.addWidget(self.edit); row.addWidget(rb)

    def value(self):
        return self.edit.text().strip()


# ── Nav sidebar ───────────────────────────────────────────────────────────────
class NavBar(QWidget):
    page_selected = pyqtSignal(int)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedWidth(NAV_W)
        self.setStyleSheet(f"background:{SURFACE}; border-right: 1px solid {BORDER};")
        self._btns = []
        vl = QVBoxLayout(self)
        vl.setContentsMargins(0, 0, 0, 0)
        vl.setSpacing(0)

        # Logo
        logo_w = QWidget(); logo_w.setStyleSheet(f"background:{SURFACE}; padding: 0;")
        logo_l = QVBoxLayout(logo_w); logo_l.setContentsMargins(18, 24, 18, 20)
        t1 = QLabel("3544"); t1.setStyleSheet(f"color:{ACCENT}; font-size:22px; font-weight:800; letter-spacing:1px;")
        t2 = QLabel("FRC Toolkit"); t2.setStyleSheet(f"color:{MUTED}; font-size:11px;")
        logo_l.addWidget(t1); logo_l.addWidget(t2)
        vl.addWidget(logo_w)
        vl.addWidget(_sep())
        vl.addSpacing(8)

        nav_items = [
            ("🏠  Home",              0),
            ("⚡  New Subsystem",     1),
        ]
        for label, idx in nav_items:
            btn = QPushButton(label); btn.setObjectName("nav_btn")
            btn.setProperty("active", "false")
            btn.clicked.connect(lambda _, i=idx: self._select(i))
            vl.addWidget(btn)
            self._btns.append(btn)

        vl.addStretch()
        lbl = QLabel("Code Generator v2"); lbl.setStyleSheet(f"color:{MUTED}; font-size:10px; padding:0 18px 16px;")
        vl.addWidget(lbl)
        self._select(0)

    def _select(self, idx):
        for i, btn in enumerate(self._btns):
            btn.setProperty("active", "true" if i == idx else "false")
            btn.style().unpolish(btn); btn.style().polish(btn)
        self.page_selected.emit(idx)


# ── Home page ─────────────────────────────────────────────────────────────────
class HomePage(QWidget):
    edit_requested = pyqtSignal(str)
    delete_requested = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        vl = QVBoxLayout(self)
        vl.setContentsMargins(32, 32, 32, 32)
        vl.setSpacing(24)

        # Header
        h = QLabel("Project Overview")
        h.setStyleSheet(f"font-size:24px; font-weight:700; color:{TEXT};")
        vl.addWidget(h)
        sub = QLabel("Generated subsystems in this project")
        sub.setStyleSheet(f"color:{MUTED}; font-size:13px;")
        vl.addWidget(sub)

        # Subsystem list (scrollable)
        scroll = QScrollArea(); scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        inner = QWidget(); self._cards_layout = QVBoxLayout(inner)
        self._cards_layout.setSpacing(10)
        self._cards_layout.setContentsMargins(0, 0, 0, 0)
        self._cards_layout.addStretch()
        scroll.setWidget(inner)
        vl.addWidget(scroll)

        refresh_btn = QPushButton("↻  Refresh")
        refresh_btn.clicked.connect(self.refresh)
        refresh_btn.setFixedWidth(120)
        vl.addWidget(refresh_btn, alignment=Qt.AlignLeft)
        self.refresh()

    def refresh(self):
        # Clear existing cards
        while self._cards_layout.count() > 1:
            item = self._cards_layout.takeAt(0)
            if item.widget(): item.widget().deleteLater()

        java_files = sorted(glob.glob(os.path.join(SUBSYSTEMS_DIR, "*Subsystem.java")))
        if not java_files:
            lbl = QLabel("No subsystems generated yet.\nUse 'New Subsystem' to create your first one.")
            lbl.setStyleSheet(f"color:{MUTED}; font-size:13px;")
            lbl.setAlignment(Qt.AlignCenter)
            self._cards_layout.insertWidget(0, lbl)
            return

        for path in java_files:
            name = os.path.basename(path).replace("Subsystem.java", "")
            card = self._make_card(name, path)
            self._cards_layout.insertWidget(self._cards_layout.count() - 1, card)

    def _make_card(self, name, path):
        frame = QFrame(); frame.setObjectName("subsystem_card")
        fl = QHBoxLayout(frame); fl.setContentsMargins(16, 14, 16, 14); fl.setSpacing(16)

        # Icon circle
        icon = QLabel(name[0].upper())
        icon.setFixedSize(42, 42); icon.setAlignment(Qt.AlignCenter)
        icon.setStyleSheet(
            f"background: qlineargradient(x1:0,y1:0,x2:1,y2:1,stop:0 {ACCENT},stop:1 {ACCENT2});"
            f"color:{TEXT}; border-radius:21px; font-size:18px; font-weight:700;")
        fl.addWidget(icon)

        info = QVBoxLayout(); info.setSpacing(3)
        title = QLabel(f"{name}Subsystem")
        title.setStyleSheet(f"color:{TEXT}; font-size:14px; font-weight:600;")

        # Parse file for quick info
        try:
            with open(path) as f: src = f.read()
            motor_m = re.search(r'\* Motor\s+: ([^\n]+)', src)
            ctrl_m  = re.search(r'\* Control : (\w+)', src)
            motor_s = motor_m.group(1) if motor_m else "—"
            ctrl_s  = ctrl_m.group(1)  if ctrl_m  else "—"
            detail  = f"{motor_s}  ·  {ctrl_s} mode"
        except Exception:
            detail = path

        detail_lbl = QLabel(detail)
        detail_lbl.setStyleSheet(f"color:{MUTED}; font-size:11px;")
        info.addWidget(title); info.addWidget(detail_lbl)
        fl.addLayout(info, 1)

        # Line count badge
        try:
            lc = len(open(path).readlines())
            lc_lbl = QLabel(f"{lc} lines")
            lc_lbl.setStyleSheet(f"color:{MUTED}; font-size:11px; padding: 3px 8px; background:{CARD}; border-radius:4px;")
            fl.addWidget(lc_lbl, alignment=Qt.AlignVCenter)
        except Exception:
            pass

        edit_btn = QPushButton("Edit")
        edit_btn.setToolTip("Load this subsystem back into the generator form.")
        edit_btn.clicked.connect(lambda: self.edit_requested.emit(path))
        fl.addWidget(edit_btn, alignment=Qt.AlignVCenter)

        delete_btn = QPushButton("Delete")
        delete_btn.setToolTip("Delete this generated subsystem and remove its robot wiring.")
        delete_btn.clicked.connect(lambda: self.delete_requested.emit(path))
        fl.addWidget(delete_btn, alignment=Qt.AlignVCenter)

        return frame


# ── New Subsystem page ────────────────────────────────────────────────────────
class NewSubsystemPage(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self._motors   = []
        self._tunables = []
        self._states   = []
        self._preview_timer = None
        self._editing_path = None
        self._build_ui()
        self._on_mode_change(0)

    def _build_ui(self):
        root = QHBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        splitter = QSplitter(Qt.Horizontal)
        splitter.setHandleWidth(1)

        # ── Left scroll panel ─────────────────────────────────────────────────
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        scroll.setMinimumWidth(680)
        scroll.setMaximumWidth(880)

        inner = QWidget()
        scroll.setWidget(inner)
        lv = QVBoxLayout(inner)
        lv.setContentsMargins(24, 24, 24, 32)
        lv.setSpacing(14)

        # Page title
        title_row = QHBoxLayout(); title_row.setSpacing(8)
        self.title_lbl = QLabel("New Subsystem")
        self.title_lbl.setStyleSheet(f"font-size:20px; font-weight:700; color:{TEXT}; margin-bottom:2px;")
        title_row.addWidget(self.title_lbl)
        title_row.addStretch()
        reset_btn = QPushButton("Reset")
        reset_btn.setToolTip("Clear the form and start a fresh subsystem.")
        reset_btn.clicked.connect(self.reset_form)
        title_row.addWidget(reset_btn)
        lv.addLayout(title_row)

        # ── 1. Identity ───────────────────────────────────────────────────────
        id_box = QGroupBox("Identity")
        id_fl  = QFormLayout(id_box)
        id_fl.setSpacing(10); id_fl.setLabelAlignment(Qt.AlignRight)
        id_fl.setFieldGrowthPolicy(QFormLayout.ExpandingFieldsGrow)

        self.name_edit = QLineEdit()
        self.name_edit.setPlaceholderText("e.g.  Intake   Elevator   Shooter")
        self.name_edit.setToolTip("PascalCase name.\n→ Generates IntakeSubsystem.java\n→ NT path /3544/Subsystems/Intake/…")
        self.name_edit.textChanged.connect(self._debounce)
        id_fl.addRow("Name:", self.name_edit)

        self.can_bus_edit = QLineEdit()
        self.can_bus_edit.setPlaceholderText("blank = default 'rio'")
        self.can_bus_edit.setToolTip(
            "CAN bus name for all devices in this subsystem.\n\n"
            "Leave blank to use the default RoboRIO CAN bus.\n"
            "Enter 'canivore' (or your CANivore name) if using a separate CAN bus.\n\n"
            "CTRE only — REV motors ignore this field."
        )
        self.can_bus_edit.textChanged.connect(self._debounce)
        id_fl.addRow("CAN Bus:", self.can_bus_edit)
        lv.addWidget(id_box)

        # ── 2. Motor Type ─────────────────────────────────────────────────────
        mtype_box = QGroupBox("Motor Type")
        mtype_vl  = QVBoxLayout(mtype_box); mtype_vl.setSpacing(8)
        note = QLabel("All motors in this subsystem share the same controller type.")
        note.setStyleSheet(f"color:{MUTED}; font-size:11px;"); note.setWordWrap(True)
        mtype_vl.addWidget(note)
        self.motor_type_combo = NoWheelComboBox()
        for k, v in MOTOR_TYPES.items():
            self.motor_type_combo.addItem(f"{v[0]}  —  {v[2]}  ({v[3]} RPM free speed)", k)
        self.motor_type_combo.setToolTip(
            "Kraken X60 / X44 / Falcon 500 → Phoenix 6 (CTRE)\n"
            "NEO / NEO 550 / NEO Vortex     → REV Robotics\n\n"
            "This selects which Java API is generated."
        )
        self.motor_type_combo.currentIndexChanged.connect(self._on_motor_type_change)
        mtype_vl.addWidget(self.motor_type_combo)
        lv.addWidget(mtype_box)

        # ── 3. Motors ─────────────────────────────────────────────────────────
        motor_box = QGroupBox("Motors  (leader + followers)")
        motor_vl  = QVBoxLayout(motor_box); motor_vl.setSpacing(6)
        self._motors_layout = QVBoxLayout(); self._motors_layout.setSpacing(8)
        motor_vl.addLayout(self._motors_layout)
        add_m = QPushButton("＋  Add Follower"); add_m.setObjectName("add_btn")
        add_m.setToolTip("Add a follower motor that mirrors the leader.\nUses Follower control (CTRE) or .follow() (REV).")
        add_m.clicked.connect(self._add_motor)
        motor_vl.addWidget(add_m, alignment=Qt.AlignLeft)
        lv.addWidget(motor_box)
        self._add_motor_card(0)

        # ── 4. Encoder & Gearing ──────────────────────────────────────────────
        enc_box = QGroupBox("Encoder & Gear Ratios")
        enc_vl  = QVBoxLayout(enc_box); enc_vl.setSpacing(10)

        self.enc_combo = NoWheelComboBox()
        self.enc_combo.setToolTip(
            "Integrated  — built-in encoder on the motor (simplest)\n"
            "CANcoder    — CTRE absolute magnetic encoder (best for arms/pivots)\n"
            "REV Absolute — absolute encoder plugged into SparkMax data port\n"
            "REV Through-bore — relative encoder on SparkMax data port"
        )
        self.enc_combo.currentIndexChanged.connect(self._on_enc_change)
        enc_vl.addLayout(_field_col("Feedback Sensor", self.enc_combo))

        self.cancoder_row = QWidget()
        cr = QHBoxLayout(self.cancoder_row); cr.setContentsMargins(0,0,0,0)
        self.cancoder_spin = NoWheelSpinBox(); self.cancoder_spin.setRange(0,62); self.cancoder_spin.setFixedWidth(80)
        self.cancoder_spin.setToolTip("CAN ID of the CANcoder (set in Phoenix Tuner X).")
        cr.addLayout(_field_col("CANcoder CAN ID", self.cancoder_spin)); cr.addStretch()
        enc_vl.addWidget(self.cancoder_row)
        self.cancoder_row.setVisible(False)

        enc_vl.addWidget(_sep())

        ratio_row = QHBoxLayout(); ratio_row.setSpacing(16)
        self.m2mech_spin = NoWheelDoubleSpinBox()
        self.m2mech_spin.setRange(0.01,500); self.m2mech_spin.setDecimals(4); self.m2mech_spin.setValue(1.0)
        self.m2mech_spin.setSingleStep(0.5)
        self.m2mech_spin.setToolTip(
            "Total motor rotations per one mechanism rotation.\n\n"
            "Example: 10:1 gearbox → enter 10.0\n\n"
            "After this, setTargetPosition(90) means 90° at the arm/elevator output."
        )
        ratio_row.addLayout(_field_col("Motor → Mechanism ratio", self.m2mech_spin))

        self.m2enc_row_widget = QWidget()
        m2enc_inner = QHBoxLayout(self.m2enc_row_widget); m2enc_inner.setContentsMargins(0,0,0,0)
        self.m2enc_spin = NoWheelDoubleSpinBox()
        self.m2enc_spin.setRange(0.01,500); self.m2enc_spin.setDecimals(4); self.m2enc_spin.setValue(1.0)
        self.m2enc_spin.setSingleStep(0.25)
        self.m2enc_spin.setToolTip(
            "Motor rotations per encoder rotation.\n\n"
            "1.0 = encoder is on the motor shaft (typical for CANcoder direct-mount)\n"
            "3.0 = encoder is after a 3:1 reduction from the motor\n\n"
            "CTRE: sets RotorToSensorRatio. Ignored when using integrated encoder."
        )
        m2enc_inner.addLayout(_field_col("Motor → Encoder ratio", self.m2enc_spin))
        ratio_row.addWidget(self.m2enc_row_widget)
        ratio_row.addStretch()
        enc_vl.addLayout(ratio_row)
        lv.addWidget(enc_box)
        self._on_motor_type_change(0)

        # ── 5. Control Mode ───────────────────────────────────────────────────
        ctrl_box = QGroupBox("Control Mode")
        ctrl_vl  = QVBoxLayout(ctrl_box); ctrl_vl.setSpacing(8)
        self.mode_combo = NoWheelComboBox()
        self.mode_combo.addItem("Velocity  —  RPM / speed control  (flywheel, conveyor, indexer)")
        self.mode_combo.addItem("Position  —  degree / meter control  (arm, elevator, wrist)")
        self.mode_combo.addItem("Open-loop  —  direct percent output  (intake, climber)")
        self.mode_combo.setToolTip(
            "Velocity  — closed-loop RPM via PID + feedforward\n"
            "Position  — closed-loop angle/distance via PID\n"
            "Open-loop — raw percent output, no feedback"
        )
        self.mode_combo.currentIndexChanged.connect(self._on_mode_change)
        ctrl_vl.addWidget(self.mode_combo)
        lv.addWidget(ctrl_box)

        # ── 6. Limit Switches (position + non-absolute only) ──────────────────
        self.limit_box = QGroupBox("Limit Switches")
        limit_vl = QVBoxLayout(self.limit_box); limit_vl.setSpacing(10)

        note2 = QLabel("Hardware limit switches for homing and travel bounds.\nAvailable for position mode with non-absolute encoders.")
        note2.setStyleSheet(f"color:{MUTED}; font-size:11px;"); note2.setWordWrap(True)
        limit_vl.addWidget(note2)

        # Forward limit
        fwd_row = QHBoxLayout(); fwd_row.setSpacing(12)
        self.fwd_enabled = QCheckBox("Forward (max travel) limit")
        self.fwd_enabled.setToolTip("Enable the forward hardware limit switch.\nStops motor from going past maximum travel.")
        self.fwd_enabled.stateChanged.connect(self._on_limit_change)
        fwd_row.addWidget(self.fwd_enabled)
        self.fwd_no_check = QCheckBox("Normally Open")
        self.fwd_no_check.setChecked(True)
        self.fwd_no_check.setToolTip("Switch is open (circuit broken) when not pressed.\nMost mechanical limit switches are normally open.")
        fwd_row.addWidget(self.fwd_no_check)
        fwd_row.addStretch()
        limit_vl.addLayout(fwd_row)

        limit_vl.addWidget(_sep())

        # Reverse limit
        rev_row = QHBoxLayout(); rev_row.setSpacing(12)
        self.rev_enabled = QCheckBox("Reverse (home) limit")
        self.rev_enabled.setToolTip("Enable the reverse hardware limit switch.\nUsed to detect the home/zero position.")
        self.rev_enabled.stateChanged.connect(self._on_limit_change)
        rev_row.addWidget(self.rev_enabled)
        self.rev_no_check = QCheckBox("Normally Open")
        self.rev_no_check.setChecked(True)
        self.rev_no_check.setToolTip("Switch is open (circuit broken) when not pressed.")
        rev_row.addWidget(self.rev_no_check)
        self.rev_autozero = QCheckBox("Auto-zero encoder when hit")
        self.rev_autozero.setChecked(True)
        self.rev_autozero.setToolTip(
            "Automatically reset encoder position to 0 when reverse limit is triggered.\n"
            "CTRE: handled by ReverseLimitAutosetPosition in firmware.\n"
            "REV: encoder.setPosition(0) called in periodic() when limit is pressed."
        )
        rev_row.addWidget(self.rev_autozero)
        rev_row.addStretch()
        limit_vl.addLayout(rev_row)

        _connect_all(self.limit_box, self._debounce)
        lv.addWidget(self.limit_box)
        self.limit_box.setVisible(False)

        # ── 7. Tunables ───────────────────────────────────────────────────────
        tun_box = QGroupBox("Live Tunables")
        tun_vl  = QVBoxLayout(tun_box); tun_vl.setSpacing(4)
        tip = QLabel("Values editable from the dashboard without redeploying.")
        tip.setStyleSheet(f"color:{MUTED}; font-size:11px;"); tun_vl.addWidget(tip); tun_vl.addSpacing(4)

        hdr = QHBoxLayout(); hdr.setSpacing(8)
        for txt, w in [("Key",88),("Label",96),("Default",100),("Step",88)]:
            l = QLabel(txt); l.setFixedWidth(w)
            l.setStyleSheet(f"color:{MUTED}; font-size:10px; font-weight:600;")
            hdr.addWidget(l)
        hdr.addStretch(); tun_vl.addLayout(hdr)
        tun_vl.addWidget(_sep())

        self._tun_layout = QVBoxLayout(); self._tun_layout.setSpacing(4)
        tun_vl.addLayout(self._tun_layout)

        add_t = QPushButton("＋  Add Tunable"); add_t.setObjectName("add_btn")
        add_t.setToolTip("Add a custom live-tunable (PID gain, setpoint, threshold, etc.)")
        add_t.clicked.connect(lambda: self._add_tunable())
        tun_vl.addWidget(add_t, alignment=Qt.AlignLeft)
        lv.addWidget(tun_box)

        # ── 8. States ─────────────────────────────────────────────────────────
        st_box = QGroupBox("State Machine States")
        st_vl  = QVBoxLayout(st_box); st_vl.setSpacing(8)
        hint = QLabel("One state per pill.  setState(\"idle\") triggers transitions.\nEach state gets an onEnterState() switch-case stub.")
        hint.setStyleSheet(f"color:{MUTED}; font-size:11px;"); hint.setWordWrap(True)
        st_vl.addWidget(hint)

        self._pills_container = QWidget()
        self._pills_flow = QVBoxLayout(self._pills_container)
        self._pills_flow.setSpacing(6); self._pills_flow.setContentsMargins(0,0,0,0)
        st_vl.addWidget(self._pills_container)

        add_s = QPushButton("＋  Add State"); add_s.setObjectName("add_btn")
        add_s.setToolTip("Common patterns:\n  idle, running, fault\n  idle, deploying, deployed, stowed\n  idle, spinning-up, at-speed, fault")
        add_s.clicked.connect(lambda: self._add_state())
        st_vl.addWidget(add_s, alignment=Qt.AlignLeft)
        lv.addWidget(st_box)

        # ── Generate button ────────────────────────────────────────────────────
        lv.addSpacing(8)
        self.gen_btn = QPushButton("⚡  Generate Subsystem")
        self.gen_btn.setObjectName("generate_btn")
        self.gen_btn.setToolTip("Write <Name>Subsystem.java to robot/src/…/subsystems/\nand patch RobotContainer.java.")
        self.gen_btn.clicked.connect(self._generate)
        lv.addWidget(self.gen_btn)

        self.status_lbl = QLabel("")
        self.status_lbl.setAlignment(Qt.AlignCenter)
        self.status_lbl.setStyleSheet(f"color:{GREEN}; font-size:12px; padding:4px;")
        lv.addWidget(self.status_lbl)
        lv.addStretch()

        splitter.addWidget(scroll)

        # ── Right: preview ────────────────────────────────────────────────────
        right = QWidget()
        rv = QVBoxLayout(right); rv.setContentsMargins(12, 20, 16, 16); rv.setSpacing(8)

        ph = QHBoxLayout()
        pl = QLabel("Live Preview"); pl.setStyleSheet(f"font-size:15px; font-weight:700; color:{ACCENT};")
        ph.addWidget(pl); ph.addStretch()
        self.file_lbl = QLabel("")
        self.file_lbl.setStyleSheet(f"color:{MUTED}; font-size:11px;")
        ph.addWidget(self.file_lbl)
        rv.addLayout(ph)

        self.preview = QTextEdit()
        self.preview.setReadOnly(True)
        self.preview.setLineWrapMode(QTextEdit.NoWrap)
        self._hl = JavaHighlighter(self.preview.document())
        rv.addWidget(self.preview)

        splitter.addWidget(right)
        splitter.setSizes([460, 760])
        root.addWidget(splitter)

    def _set_combo_data(self, combo, value):
        idx = combo.findData(value)
        if idx >= 0:
            combo.setCurrentIndex(idx)

    def reset_form(self):
        self._editing_path = None
        self.title_lbl.setText("New Subsystem")
        self.name_edit.clear()
        self.can_bus_edit.clear()
        self.status_lbl.setText("")
        self._clear_motors()
        self._add_motor_card(0)
        self.motor_type_combo.setCurrentIndex(0)
        self._on_motor_type_change(0)
        self.cancoder_spin.setValue(0)
        self.m2mech_spin.setValue(1.0)
        self.m2enc_spin.setValue(1.0)
        self.mode_combo.setCurrentIndex(0)
        self.fwd_enabled.setChecked(False)
        self.fwd_no_check.setChecked(True)
        self.rev_enabled.setChecked(False)
        self.rev_no_check.setChecked(True)
        self.rev_autozero.setChecked(True)
        self._on_mode_change(0)

    def load_config(self, cfg, source_path=None):
        self._editing_path = source_path
        name = cfg.get("name", "MySubsystem")
        self.title_lbl.setText(f"Edit {name}Subsystem" if source_path else "New Subsystem")
        self.name_edit.setText(name)
        self.can_bus_edit.setText(cfg.get("can_bus", ""))
        self.status_lbl.setText("")

        self._clear_motors()
        for i, m in enumerate(cfg.get("motors", []) or [{"name":"LeaderMotor","can_id":0,"pdh_ch":0,"inverted":False}]):
            self._add_motor_card(i)
            card = self._motors[-1]
            card.name_edit.setText(m.get("name", "LeaderMotor" if i == 0 else f"Follower{i}"))
            card.can_spin.setValue(int(m.get("can_id", i)))
            card.pdh_spin.setValue(int(m.get("pdh_ch", i)))
            card.inv_check.setChecked(bool(m.get("inverted", False)))

        self._set_combo_data(self.motor_type_combo, cfg.get("motor_type", "kraken_x60"))
        self._on_motor_type_change(0)
        self._set_combo_data(self.enc_combo, cfg.get("encoder_type", "integrated"))
        self._on_enc_change(0)
        self.cancoder_spin.setValue(int(cfg.get("cancoder_id", 0)))
        self.m2mech_spin.setValue(float(cfg.get("motor_to_mech_ratio", 1.0)))
        self.m2enc_spin.setValue(float(cfg.get("motor_to_encoder_ratio", 1.0)))

        mode_idx = {"velocity": 0, "position": 1, "open_loop": 2}.get(cfg.get("mode", "velocity"), 0)
        self.mode_combo.setCurrentIndex(mode_idx)
        self._on_mode_change(mode_idx)
        self._clear_tunables()
        for t in cfg.get("tunables", []):
            self._add_tunable(t.get("key", "kP"), t.get("label", t.get("key", "kP")),
                              float(t.get("default", 0.0)), float(t.get("step", 0.01)))
        self._clear_states()
        for st in cfg.get("states", []) or ["idle", "running", "fault"]:
            self._add_state(st)

        limit_fwd = cfg.get("limit_fwd", {"enabled": False, "normally_open": True})
        limit_rev = cfg.get("limit_rev", {"enabled": False, "normally_open": True, "auto_zero": True})
        self.fwd_enabled.setChecked(bool(limit_fwd.get("enabled", False)))
        self.fwd_no_check.setChecked(bool(limit_fwd.get("normally_open", True)))
        self.rev_enabled.setChecked(bool(limit_rev.get("enabled", False)))
        self.rev_no_check.setChecked(bool(limit_rev.get("normally_open", True)))
        self.rev_autozero.setChecked(bool(limit_rev.get("auto_zero", True)))
        self._update_limit_visibility()
        self._debounce()

    def _clear_motors(self):
        for card in list(self._motors):
            self._motors_layout.removeWidget(card)
            card.deleteLater()
        self._motors.clear()

    def _clear_states(self):
        for pill in list(self._states):
            pill.setParent(None)
            pill.deleteLater()
        self._states.clear()
        while self._pills_flow.count():
            item = self._pills_flow.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()

    # ── Motor management ──────────────────────────────────────────────────────
    def _add_motor_card(self, idx):
        card = MotorCard(idx)
        card.removed.connect(self._remove_motor)
        card.changed.connect(self._debounce)
        self._motors_layout.addWidget(card)
        self._motors.append(card)

    def _add_motor(self):
        self._add_motor_card(len(self._motors)); self._debounce()

    def _remove_motor(self, card):
        self._motors_layout.removeWidget(card); card.deleteLater()
        self._motors.remove(card)
        for i, c in enumerate(self._motors):
            badge = c.findChildren(QLabel)[0]
            if i == 0:
                badge.setText("LEADER")
                badge.setStyleSheet(f"background:{ACCENT}; color:{BG}; border-radius:4px; font-size:10px; font-weight:700; padding:2px 6px;")
            else:
                badge.setText(f"FOLLOWER {i}")
                badge.setStyleSheet(f"background:{CARD}; color:{MUTED}; border:1px solid {BORDER}; border-radius:4px; font-size:10px; font-weight:600; padding:2px 6px;")
        self._debounce()

    # ── Motor type / encoder change ───────────────────────────────────────────
    def _on_motor_type_change(self, _=None):
        motor_key = self.motor_type_combo.currentData() or "kraken_x60"
        vendor = MOTOR_TYPES.get(motor_key, ("","ctre","",""))[1]
        self.enc_combo.blockSignals(True)
        self.enc_combo.clear()
        self._enc_keys = []
        for k, v in ENCODER_TYPES.items():
            if vendor in v[1]:
                self.enc_combo.addItem(v[0], k)
                self._enc_keys.append(k)
        self.enc_combo.blockSignals(False)
        self._on_enc_change(0)
        self._debounce()

    def _on_enc_change(self, _=None):
        enc_key = self.enc_combo.currentData() or "integrated"
        self.cancoder_row.setVisible(enc_key == "cancoder")
        self.m2enc_row_widget.setVisible(enc_key != "integrated")
        self._update_limit_visibility()
        self._debounce()

    def _on_mode_change(self, idx):
        self._clear_tunables()
        mode = ["velocity","position","open_loop"][idx]
        if mode == "velocity":
            for k,l,d,s in [("kP","kP",0.005,0.001),("kV","kV (ff)",0.00018,0.0001),("TargetRPM","Target RPM",1000.0,100.0)]:
                self._add_tunable(k,l,d,s)
            if not self._states:
                for st in ["idle","spinning-up","at-speed","fault"]: self._add_state(st)
        elif mode == "position":
            for k,l,d,s in [("kP","kP",0.1,0.01),("kD","kD",0.0,0.001),("TargetDeg","Target °",0.0,5.0)]:
                self._add_tunable(k,l,d,s)
            if not self._states:
                for st in ["idle","moving","at-target","fault"]: self._add_state(st)
        else:
            if not self._states:
                for st in ["idle","running","fault"]: self._add_state(st)
        self._update_limit_visibility()
        self._debounce()

    def _on_limit_change(self, _=None):
        self._debounce()

    def _update_limit_visibility(self):
        if not hasattr(self, 'mode_combo') or not hasattr(self, 'limit_box'):
            return
        mode_idx = self.mode_combo.currentIndex()
        enc_key  = self.enc_combo.currentData() or "integrated"
        show = (mode_idx == 1) and not encoder_is_absolute(enc_key)
        self.limit_box.setVisible(show)

    # ── Tunable management ────────────────────────────────────────────────────
    def _add_tunable(self, key="kP", label="kP", default=0.0, step=0.01):
        row = TunableRow(key, label, default, step)
        row.removed.connect(self._remove_tunable)
        row.changed.connect(self._debounce)
        self._tun_layout.addWidget(row)
        self._tunables.append(row)
        self._debounce()

    def _remove_tunable(self, row):
        self._tun_layout.removeWidget(row); row.deleteLater()
        self._tunables.remove(row); self._debounce()

    def _clear_tunables(self):
        for row in list(self._tunables):
            self._tun_layout.removeWidget(row); row.deleteLater()
        self._tunables.clear()

    # ── State management ──────────────────────────────────────────────────────
    def _add_state(self, name="idle"):
        pill = StatePill(name)
        pill.removed.connect(self._remove_state)
        pill.changed.connect(self._debounce)
        self._states.append(pill)
        self._relayout_pills()
        self._debounce()

    def _remove_state(self, pill):
        self._states.remove(pill); self._relayout_pills(); self._debounce()

    def _relayout_pills(self):
        for pill in self._states:
            pill.setParent(self._pills_container); pill.hide()
        while self._pills_flow.count():
            item = self._pills_flow.takeAt(0)
            w = item.widget()
            if w: w.deleteLater()
        row_l = None
        for i, pill in enumerate(self._states):
            if i % 4 == 0:
                row_w = QWidget(); row_w.setParent(self._pills_container)
                row_l = QHBoxLayout(row_w); row_l.setContentsMargins(0,0,0,0); row_l.setSpacing(6)
                self._pills_flow.addWidget(row_w)
            row_l.addWidget(pill); pill.show()
        if row_l: row_l.addStretch()

    # ── Config collection ─────────────────────────────────────────────────────
    def _collect_cfg(self):
        raw = self.name_edit.text().strip() or "MySubsystem"
        if raw.lower().endswith("subsystem"): raw = raw[:-9]
        name = raw[0].upper() + raw[1:]

        motor_type = self.motor_type_combo.currentData() or "kraken_x60"
        motors = [c.data() for c in self._motors] or [{"name":"Motor1","can_id":0,"pdh_ch":0,"inverted":False}]
        enc_type = self.enc_combo.currentData() or "integrated"
        mode_map = {0:"velocity",1:"position",2:"open_loop"}
        mode = mode_map[self.mode_combo.currentIndex()]

        limit_fwd = {
            "enabled": self.fwd_enabled.isChecked(),
            "normally_open": self.fwd_no_check.isChecked(),
        }
        limit_rev = {
            "enabled": self.rev_enabled.isChecked(),
            "normally_open": self.rev_no_check.isChecked(),
            "auto_zero": self.rev_autozero.isChecked(),
        }

        return {
            "name": name,
            "can_bus": self.can_bus_edit.text().strip(),
            "motors": motors,
            "motor_type": motor_type,
            "encoder_type": enc_type,
            "cancoder_id": self.cancoder_spin.value(),
            "motor_to_encoder_ratio": self.m2enc_spin.value(),
            "motor_to_mech_ratio": self.m2mech_spin.value(),
            "mode": mode,
            "tunables": [r.data() for r in self._tunables],
            "states": [p.value() for p in self._states if p.value()] or ["idle","running","fault"],
            "limit_fwd": limit_fwd,
            "limit_rev": limit_rev,
        }

    # ── Preview ───────────────────────────────────────────────────────────────
    def _debounce(self, *_):
        if self._preview_timer: self._preview_timer.stop()
        t = QTimer(self); t.setSingleShot(True); t.timeout.connect(self._refresh); t.start(160)
        self._preview_timer = t

    def _refresh(self):
        try:
            cfg  = self._collect_cfg()
            java = gen_subsystem(cfg)
            self.preview.setPlainText(java)
            self.file_lbl.setText(f"robot/…/subsystems/{cfg['name']}Subsystem.java")
            self.gen_btn.setEnabled(True)
        except Exception as e:
            self.preview.setPlainText(f"// Preview error:\n// {e}")
            self.gen_btn.setEnabled(False)

    # ── Generate ──────────────────────────────────────────────────────────────
    def _generate(self):
        try:
            cfg = self._collect_cfg()
            os.makedirs(SUBSYSTEMS_DIR, exist_ok=True)
            out = os.path.join(SUBSYSTEMS_DIR, f"{cfg['name']}Subsystem.java")
            if os.path.exists(out):
                if QMessageBox.question(
                    self, "Overwrite?",
                    f"{cfg['name']}Subsystem.java already exists.\nOverwrite it?",
                    QMessageBox.Yes | QMessageBox.No
                ) != QMessageBox.Yes:
                    return

            with open(out, "w") as f:
                f.write(gen_subsystem(cfg))

            msgs = [f"✓  {out}"]
            if patch_constants(cfg):
                msgs.append("✓  Patched Constants.java")
            if os.path.exists(ROBOT_CONTAINER):
                patch_robot_container(cfg)
                validate_robot_wiring(cfg)
                msgs.append("✓  Patched RobotContainer.java")

            self.status_lbl.setStyleSheet(f"color:{GREEN}; font-size:12px; padding:4px;")
            self.status_lbl.setText("  ".join(msgs))
            self._editing_path = out
            self.title_lbl.setText(f"Edit {cfg['name']}Subsystem")
        except Exception as e:
            self.status_lbl.setStyleSheet(f"color:{RED}; font-size:12px; padding:4px;")
            self.status_lbl.setText(f"✗  {e}")


# ── Main window ───────────────────────────────────────────────────────────────
class GeneratorWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("3544 FRC — Subsystem Generator")
        self.setMinimumSize(1100, 720)
        self.resize(1400, 900)

        central = QWidget()
        self.setCentralWidget(central)
        root = QHBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        self._nav = NavBar()
        root.addWidget(self._nav)

        self._pages = QStackedWidget()
        root.addWidget(self._pages, 1)

        self._home_page = HomePage()
        self._new_page  = NewSubsystemPage()
        self._pages.addWidget(self._home_page)
        self._pages.addWidget(self._new_page)

        self._nav.page_selected.connect(self._switch_page)
        self._home_page.edit_requested.connect(self._edit_subsystem)
        self._home_page.delete_requested.connect(self._delete_subsystem)

    def _switch_page(self, idx):
        if idx == 0:
            self._home_page.refresh()
        self._pages.setCurrentIndex(idx)

    def _edit_subsystem(self, path):
        try:
            cfg = load_subsystem_config(path)
            self._new_page.load_config(cfg, path)
            self._nav._select(1)
        except Exception as e:
            QMessageBox.warning(self, "Could not load subsystem", str(e))

    def _delete_subsystem(self, path):
        name = os.path.basename(path).replace("Subsystem.java", "")
        if QMessageBox.question(
            self, "Delete subsystem?",
            f"Delete {name}Subsystem.java and remove generated constants, RobotContainer wiring, and DashboardManager wiring?",
            QMessageBox.Yes | QMessageBox.No
        ) != QMessageBox.Yes:
            return
        try:
            delete_subsystem(path)
            if self._new_page._editing_path == path:
                self._new_page.reset_form()
            self._home_page.refresh()
        except Exception as e:
            QMessageBox.warning(self, "Could not delete subsystem", str(e))


# ── Entry ─────────────────────────────────────────────────────────────────────
def main():
    app = QApplication(sys.argv)
    app.setStyleSheet(SS)
    win = GeneratorWindow()
    win.show()
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()
