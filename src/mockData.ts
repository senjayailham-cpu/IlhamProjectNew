import { Project, Employee, TimesheetEntry, ActivityLog, User, ProblemReport, InspectionRequest } from './types';

// Standard seed users (passwords are 'admin123' for admin, '123456' for rizki/hasrad)
export const DEFAULT_USERS = async (): Promise<User[]> => {
  const sha256 = async (str: string) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  return [
    {
      id: 'admin',
      name: 'Administrator',
      role: 'admin',
      passHash: await sha256('admin123')
    },
    {
      id: 'rizki',
      name: 'Rizki PPC',
      role: 'manager',
      passHash: await sha256('123456')
    },
    {
      id: 'hasrad',
      name: 'Hasrad Rudin Ismail',
      role: 'manager',
      passHash: await sha256('123456')
    },
    {
      id: 'facility',
      name: 'Facility Specialist',
      role: 'facility maintanance',
      passHash: await sha256('123456')
    },
    {
      id: 'qc',
      name: 'QC Inspector',
      role: 'quality control',
      passHash: await sha256('123456')
    },
    {
      id: 'safety_user',
      name: 'Safety Officer',
      role: 'safety',
      passHash: await sha256('123456')
    },
    {
      id: 'pc',
      name: 'Project Controller',
      role: 'project control',
      passHash: await sha256('123456')
    }
  ];
};

export const DEFAULT_EMPLOYEES: Employee[] = [
  { id: 'emp_1', name: 'John Smith', position: 'Field Engineer', location: 'Site A - Jakarta', coordinator: 'Rizki PPC' },
  { id: 'emp_2', name: 'Ahmad Fauzi', position: 'Mechanical Supervisor', location: 'Site B - Batam', coordinator: 'Rizki PPC' },
  { id: 'emp_3', name: 'Lars Paulsen', position: 'Automation Tech', location: 'Site A - Jakarta', coordinator: 'Hasrad Rudin Ismail' },
  { id: 'emp_4', name: 'Siti Aminah', position: 'HSE Coordinator', location: 'Workshop 1', coordinator: 'Hasrad Rudin Ismail' },
  { id: 'emp_5', name: 'Agus Setiawan', position: 'Welder Class 1', location: 'Workshop 1', coordinator: 'Rizki PPC' },
  { id: 'emp_6', name: 'Budi Santoso', position: 'E&I Installer', location: 'Workshop 2', coordinator: 'Rizki PPC' },
  { id: 'emp_7', name: 'Hendrik Wijaya', position: 'Fitter Crew', location: 'Workshop 2', coordinator: 'Hasrad Rudin Ismail' }
];

export const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'proj_1',
    name: 'Main Deck Piping Structural Assembly',
    client: 'WO-2026-001',
    start: '2026-06-01',
    due: '2026-06-25',
    status: 'active',
    category: 'tray',
    location: 'workshop1',
    created: '2026-06-01',
    notes: 'Primary main deck steel layout with class-1 welding requirements. Check NDT status daily.',
    budgetHours: 30, // Exceeds 30h budget (34h total used), will trigger red highlight
    assemblies: [
      {
        id: 'asm_1_1',
        name: 'Steel Framing and Fitting',
        notes: 'Pre-fabrication structural jigs layout',
        start: '2026-06-01',
        finish: '2026-06-10',
        budgetHours: 15, // Used is 18 hours (exceeds budget!), will turn red
        tasks: [
          { id: 't_1_1_1', name: 'Cut columns and base plates', assigned: 'Agus Setiawan', pct: 100, done: true },
          { id: 't_1_1_2', name: 'Fit up and tack-weld structural beams', assigned: 'Agus Setiawan', pct: 100, done: true },
          { id: 't_1_1_3', name: 'Base alignment inspections', assigned: 'John Smith', pct: 100, done: true }
        ],
        predecessors: [],
        successors: [{ key: 'a:proj_1:asm_1_2', type: 'FS', lag: 0 }]
      },
      {
        id: 'asm_1_2',
        name: 'Electrical Conduit Pathing & Cable Tray',
        notes: 'Power routing and instrument cabling trays installation',
        start: '2026-06-11',
        finish: '2026-06-18',
        budgetHours: 20, // Used is 16 hours (within budget!), will stay normal/green
        tasks: [
          { id: 't_1_2_1', name: 'Run conduit lines on frames', assigned: 'Budi Santoso', pct: 60, done: false },
          { id: 't_1_2_2', name: 'Mount intermediate cable junction boxes', assigned: 'Ahmad Fauzi', pct: 40, done: false }
        ],
        predecessors: [{ key: 'a:proj_1:asm_1_1', type: 'FS', lag: 0 }],
        successors: [{ key: 'a:proj_1:asm_1_3', type: 'FS', lag: 0 }]
      },
      {
        id: 'asm_1_3',
        name: 'Finishing and NDT Stress Testing',
        notes: 'Magnetic particle testing and surface coat application',
        start: '2026-06-19',
        finish: '2026-06-25',
        tasks: [
          { id: 't_1_3_1', name: 'High-pressure hydrostatic hold test', assigned: 'John Smith', pct: 0, done: false },
          { id: 't_1_3_2', name: 'Epoxy barrier priming coat', assigned: 'Siti Aminah', pct: 0, done: false }
        ],
        predecessors: [{ key: 'a:proj_1:asm_1_2', type: 'FS', lag: 0 }],
        successors: []
      }
    ],
    predecessors: [],
    successors: [{ key: 'p:proj_2', type: 'FS', lag: 2 }]
  },
  {
    id: 'proj_2',
    name: 'Module Control Panel Upgrade',
    client: 'WO-2026-002',
    start: '2026-06-10',
    due: '2026-06-30',
    status: 'pending',
    category: 'nontray',
    location: 'workshop2',
    created: '2026-06-03',
    notes: 'PLC upgrade and telemetry installation. Needs FAT inspection.',
    budgetHours: 80,
    assemblies: [
      {
        id: 'asm_2_1',
        name: 'PLC Unit Mount and Power Hookup',
        notes: 'Siemens controller bracket framing and high-amp isolation lines',
        start: '2026-06-10',
        finish: '2026-06-20',
        budgetHours: 40,
        tasks: [
          { id: 't_2_1_1', name: 'Frame panel enclosure box inside Workshop 2', assigned: 'Lars Paulsen', pct: 0, done: false },
          { id: 't_2_1_2', name: 'Pull main bus redundant power feed', assigned: 'Hendrik Wijaya', pct: 0, done: false }
        ],
        predecessors: [],
        successors: []
      }
    ],
    predecessors: [{ key: 'p:proj_1', type: 'FS', lag: 2 }],
    successors: []
  }
];

export const DEFAULT_TIMESHEETS: TimesheetEntry[] = [
  // Seed entries for yesterday's date
  {
    id: 'ts_entry_1',
    date: '2026-06-11',
    empId: 'emp_1',
    empName: 'John Smith',
    workOrder: 'WO-2026-001',
    assemblyId: 'asm_1_1',
    assemblyName: 'Steel Framing and Fitting',
    totalHours: 8,
    status: 'present',
    desc: 'Supervised vertical base fitups'
  },
  {
    id: 'ts_entry_2',
    date: '2026-06-11',
    empId: 'emp_5',
    empName: 'Agus Setiawan',
    workOrder: 'WO-2026-001',
    assemblyId: 'asm_1_1',
    assemblyName: 'Steel Framing and Fitting',
    totalHours: 10,
    status: 'present',
    desc: 'Primary beam welding and plate cutting'
  },
  {
    id: 'ts_entry_3',
    date: '2026-06-11',
    empId: 'emp_2',
    empName: 'Ahmad Fauzi',
    workOrder: 'WO-2026-001',
    assemblyId: 'asm_1_2',
    assemblyName: 'Electrical Conduit Pathing & Cable Tray',
    totalHours: 8,
    status: 'present',
    desc: 'Cable tray fit up layout alignment'
  },
  {
    id: 'ts_entry_4',
    date: '2026-06-11',
    empId: 'emp_4',
    empName: 'Siti Aminah',
    workOrder: 'WO-2026-001',
    assemblyId: 'asm_1_2',
    assemblyName: 'Electrical Conduit Pathing & Cable Tray',
    totalHours: 8,
    status: 'present',
    desc: 'Safety inspection and weld gas checks'
  }
];

export const DEFAULT_ACTIVITIES: ActivityLog[] = [
  {
    id: 'act_1',
    ts: '2026-06-11T09:12:00.000Z',
    date: '2026-06-11',
    time: '09:12 AM',
    userId: 'rizki',
    userName: 'Rizki PPC',
    userRole: 'manager',
    type: 'task_progress',
    action: 'Updated task progress',
    projectId: 'proj_1',
    projectName: 'Main Deck Piping Structural Assembly',
    assemblyName: 'Steel Framing and Fitting',
    taskName: 'Base alignment inspections',
    oldPct: 50,
    newPct: 100,
    detail: 'Final alignment confirmed accurate within tolerance'
  },
  {
    id: 'act_2',
    ts: '2026-06-11T14:45:00.000Z',
    date: '2026-06-11',
    time: '02:45 PM',
    userId: 'admin',
    userName: 'Administrator',
    userRole: 'admin',
    type: 'task_progress',
    action: 'Updated task progress',
    projectId: 'proj_1',
    projectName: 'Main Deck Piping Structural Assembly',
    assemblyName: 'Electrical Conduit Pathing & Cable Tray',
    taskName: 'Run conduit lines on frames',
    oldPct: 20,
    newPct: 60,
    detail: 'Ran conduits on structural columns C-4 through C-8'
  }
];

export const DEFAULT_PROBLEM_REPORTS: ProblemReport[] = [
  {
    id: 'rep_1',
    projectId: 'proj_1',
    projectName: 'Main Deck Piping Structural Assembly',
    category: 'Drawing Issue',
    description: 'Revision 2 drawings for assembly Steel Framing and Fitting are missing clear dimension markings for secondary base plate bevel angles.',
    assignedPosition: 'Project Control',
    reportedBy: 'Agus Setiawan',
    date: '2026-06-11',
    status: 'Open',
    photo: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'rep_2',
    projectId: 'proj_1',
    projectName: 'Main Deck Piping Structural Assembly',
    category: 'Safety Issue',
    description: 'Weld gas regulator gauge on Cylinder #12 (MIG station 3 in Workshop 1) is leaking slow bubbles when pressurized.',
    assignedPosition: 'HSE',
    reportedBy: 'Siti Aminah',
    date: '2026-06-12',
    status: 'Open'
  },
  {
    id: 'rep_3',
    projectId: 'proj_2',
    projectName: 'Tension Cable Tray Suspension Bracket',
    category: 'Material Issue',
    description: 'Missing three pieces of 80mm stainless steel threaded rods required to complete assembly hanger support rods installation.',
    assignedPosition: 'Material Procces',
    reportedBy: 'Hendrik Wijaya',
    date: '2026-06-12',
    status: 'Resolved',
    resolutionNote: 'Restocked from Area B storehouse and delivered to Workshop 2 workbench directly.',
    resolvedAt: '2026-06-13',
    resolvedBy: 'Rizki PPC'
  }
];

export const DEFAULT_INSPECTION_REQUESTS: InspectionRequest[] = [
  {
    id: 'rfi_1',
    rfiNo: 'RFI-2026-001',
    projectId: 'proj_1',
    projectName: 'Main Deck Piping Structural Assembly',
    assemblyId: 'asm_1_1',
    assemblyName: 'Steel Framing and Fitting',
    inspectionType: 'Fit-up',
    status: 'Approved',
    requestedBy: 'Agus Setiawan',
    requestedById: 'rizki',
    requestedDate: '2026-06-08',
    targetDate: '2026-06-09',
    assignedInspector: 'QC Inspector',
    comments: 'All dimensions are within the +/- 2mm technical tolerance. Fit-up is accepted. Proceed to full welding.',
    inspectedDate: '2026-06-09',
    inspectedBy: 'QC Inspector'
  },
  {
    id: 'rfi_2',
    rfiNo: 'RFI-2026-002',
    projectId: 'proj_1',
    projectName: 'Main Deck Piping Structural Assembly',
    assemblyId: 'asm_1_2',
    assemblyName: 'Primary Welded Joints',
    inspectionType: 'Welding Visual',
    status: 'Rejected / Punchlist',
    requestedBy: 'Agus Setiawan',
    requestedById: 'rizki',
    requestedDate: '2026-06-11',
    targetDate: '2026-06-12',
    assignedInspector: 'QC Inspector',
    comments: 'Root porosity observed at joint #W-14 and undercut on joint #W-15. Rework/grind-out and re-weld is required.',
    punchList: '- Grind out porosity on weld joint W-14\n- Repair undercut on weld joint W-15\n- Re-visual check by Supervisor',
    inspectedDate: '2026-06-12',
    inspectedBy: 'QC Inspector'
  },
  {
    id: 'rfi_3',
    rfiNo: 'RFI-2026-003',
    projectId: 'proj_2',
    projectName: 'Tension Cable Tray Suspension Bracket',
    assemblyId: 'asm_2_1',
    assemblyName: 'Bracket Profiling & Punching',
    inspectionType: 'Dimensional Check',
    status: 'Requested',
    requestedBy: 'Hendrik Wijaya',
    requestedById: 'rizki',
    requestedDate: '2026-06-13',
    targetDate: '2026-06-14',
    assignedInspector: 'QC Inspector',
    rcomments: 'Brackets completed, ready for dimension sign-off before hot-dip galvanizing process.'
  }
];

