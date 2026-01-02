
export const adminPage = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>订阅管理系统</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
  <style>
    /* Custom Styles */
    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); transition: all 0.3s; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
    .btn-danger { background: linear-gradient(135deg, #ff5f6d 0%, #ffc371 100%); transition: all 0.3s; }
    .btn-danger:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
    .card-hover { transition: all 0.3s; }
    .card-hover:hover { transform: translateY(-5px); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); }
    
    .toast {
      position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 8px;
      color: white; font-weight: 500; z-index: 1000; transform: translateX(400px);
      transition: all 0.3s ease-in-out; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .toast.show { transform: translateX(0); }
    .toast.success { background-color: #10b981; }
    .toast.error { background-color: #ef4444; }
    .toast.info { background-color: #3b82f6; }
    
    /* Calendar Styles */
    .calendar-popup {
      display: none;
      position: absolute;
      background: white;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      width: 320px;
      z-index: 100;
      padding: 10px;
      border: 1px solid #e2e8f0;
    }
    .calendar-popup.show { display: block; }
    .calendar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }
    .calendar-day-header {
      text-align: center;
      font-size: 0.8rem;
      color: #718096;
      padding: 5px 0;
    }
    .calendar-day {
      text-align: center;
      padding: 8px 0;
      cursor: pointer;
      border-radius: 4px;
      font-size: 0.9rem;
      position: relative;
    }
    .calendar-day:hover { background-color: #ebf4ff; }
    .calendar-day.today { background-color: #bee3f8; font-weight: bold; }
    .calendar-day.selected { background-color: #667eea; color: white; }
    .calendar-day.selected .lunar-text { color: #e2e8f0; }
    .calendar-day.other-month { color: #cbd5e0; }
    .lunar-text {
      font-size: 0.6rem;
      color: #a0aec0;
      margin-top: -2px;
    }
    /* Tooltip Styles */
    .hover-container { position: relative; width: 100%; }
    .hover-text { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; transition: all 0.3s ease; display: block; }
    .hover-text:hover { color: #3b82f6; }
    .hover-tooltip {
      position: fixed; z-index: 9999; background: #1f2937; color: white; padding: 10px 14px;
      border-radius: 8px; font-size: 0.875rem; max-width: 320px; word-wrap: break-word;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2); opacity: 0; visibility: hidden;
      transition: all 0.3s ease; transform: translateY(-10px); white-space: normal; pointer-events: none; line-height: 1.4;
    }
    .hover-tooltip.show { opacity: 1; visibility: visible; transform: translateY(0); }
    .hover-tooltip::before {
      content: ''; position: absolute; top: -6px; left: 20px; border-left: 6px solid transparent;
      border-right: 6px solid transparent; border-bottom: 6px solid #1f2937;
    }
    .hover-tooltip.tooltip-above::before { top: auto; bottom: -6px; border-bottom: none; border-top: 6px solid #1f2937; }
  </style>
</head>
<body class="bg-gray-100 min-h-screen font-sans">
  <nav class="bg-white shadow-md">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <i class="fas fa-calendar-check text-indigo-600 text-2xl mr-2"></i>
          <span class="font-bold text-xl text-gray-800">订阅管理系统</span>
        </div>
        <div class="flex items-center space-x-4">
          <div class="text-gray-600 text-sm hidden md:block mr-2" id="systemTimeDisplay"></div>
          <a href="/admin/config" class="text-gray-600 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium transition duration-150">
            <i class="fas fa-cog mr-1"></i>系统配置
          </a>
          <form action="/api/logout" method="POST" class="inline">
            <button type="submit" class="text-gray-600 hover:text-red-500 px-3 py-2 rounded-md text-sm font-medium transition duration-150">
              <i class="fas fa-sign-out-alt mr-1"></i>退出
            </button>
          </form>
        </div>
      </div>
    </div>
  </nav>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Dashboard Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-xl shadow-sm p-6 card-hover border-l-4 border-indigo-500">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-indigo-100 text-indigo-500">
            <i class="fas fa-list-ul text-xl"></i>
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-500 font-medium">总订阅数</p>
            <p class="text-2xl font-bold text-gray-800" id="totalCount">-</p>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 card-hover border-l-4 border-green-500">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-green-100 text-green-500">
            <i class="fas fa-check-circle text-xl"></i>
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-500 font-medium">活跃订阅</p>
            <p class="text-2xl font-bold text-gray-800" id="activeCount">-</p>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 card-hover border-l-4 border-yellow-500">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-yellow-100 text-yellow-500">
            <i class="fas fa-clock text-xl"></i>
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-500 font-medium">即将到期(7天)</p>
            <p class="text-2xl font-bold text-gray-800" id="expiringCount">-</p>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 card-hover border-l-4 border-blue-500">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-blue-100 text-blue-500">
            <i class="fas fa-wallet text-xl"></i>
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-500 font-medium">本月预估支出</p>
            <p class="text-2xl font-bold text-gray-800" id="monthlyExpense">-</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h2 class="text-lg font-semibold text-gray-800"><i class="fas fa-tasks mr-2 text-indigo-500"></i>订阅列表</h2>
        <button onclick="openModal()" class="btn-primary px-4 py-2 rounded-lg text-white text-sm font-medium shadow-md flex items-center">
          <i class="fas fa-plus mr-2"></i>添加订阅
        </button>
      </div>
      
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">服务名称</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">周期</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">到期时间</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200" id="subscriptionList">
            <tr>
              <td colspan="6" class="px-6 py-10 text-center text-gray-500">
                <i class="fas fa-spinner fa-spin mr-2"></i>加载中...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Modal -->
  <div id="subscriptionModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 hidden overflow-y-auto h-full w-full z-50 flex items-center justify-center">
    <div class="relative mx-auto p-5 border w-full max-w-xl shadow-lg rounded-xl bg-white">
      <div class="flex justify-between items-center mb-5 pb-3 border-b">
        <h3 class="text-xl font-bold text-gray-900" id="modalTitle">添加订阅</h3>
        <button id="closeModal" class="text-gray-400 hover:text-gray-600 transition duration-150">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      
      <form id="subscriptionForm" class="space-y-4">
        <input type="hidden" id="subscriptionId">
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">服务名称</label>
            <input type="text" id="name" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">自定义类型</label>
            <input type="text" id="customType" placeholder="如：影视会员" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">周期数值</label>
            <input type="number" id="periodValue" required min="1" value="1" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">周期单位</label>
            <select id="periodUnit" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="month">月</option>
              <option value="year">年</option>
              <option value="day">天</option>
            </select>
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div class="relative">
            <label class="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
            <input type="text" id="startDate" required readonly class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer bg-white">
            <div id="startDateLunar" class="text-xs text-gray-500 mt-1 h-4"></div>
            
            <!-- Custom Date Picker -->
            <div id="startDatePicker" class="calendar-popup">
              <div class="calendar-header">
                <button type="button" id="startDatePrevMonth" class="text-gray-500 hover:text-indigo-600"><i class="fas fa-chevron-left"></i></button>
                <div class="font-bold text-gray-700"><span id="startDateYear"></span>年 <span id="startDateMonth"></span></div>
                <button type="button" id="startDateNextMonth" class="text-gray-500 hover:text-indigo-600"><i class="fas fa-chevron-right"></i></button>
              </div>
              <div class="calendar-grid">
                <div class="calendar-day-header">日</div>
                <div class="calendar-day-header">一</div>
                <div class="calendar-day-header">二</div>
                <div class="calendar-day-header">三</div>
                <div class="calendar-day-header">四</div>
                <div class="calendar-day-header">五</div>
                <div class="calendar-day-header">六</div>
              </div>
              <div id="startDateCalendar" class="calendar-grid"></div>
            </div>
          </div>
          
          <div class="relative">
            <label class="block text-sm font-medium text-gray-700 mb-1">到期日期</label>
            <input type="text" id="expiryDate" required readonly class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer bg-white">
            <div id="expiryDateLunar" class="text-xs text-gray-500 mt-1 h-4"></div>
            
            <!-- Custom Date Picker -->
            <div id="expiryDatePicker" class="calendar-popup">
              <div class="calendar-header">
                <button type="button" id="expiryDatePrevMonth" class="text-gray-500 hover:text-indigo-600"><i class="fas fa-chevron-left"></i></button>
                <div class="font-bold text-gray-700"><span id="expiryDateYear"></span>年 <span id="expiryDateMonth"></span></div>
                <button type="button" id="expiryDateNextMonth" class="text-gray-500 hover:text-indigo-600"><i class="fas fa-chevron-right"></i></button>
              </div>
              <div class="calendar-grid">
                <div class="calendar-day-header">日</div>
                <div class="calendar-day-header">一</div>
                <div class="calendar-day-header">二</div>
                <div class="calendar-day-header">三</div>
                <div class="calendar-day-header">四</div>
                <div class="calendar-day-header">五</div>
                <div class="calendar-day-header">六</div>
              </div>
              <div id="expiryDateCalendar" class="calendar-grid"></div>
            </div>
          </div>
        </div>
        
        <div class="flex items-center space-x-4 bg-gray-50 p-3 rounded-lg">
           <div class="flex items-center">
            <input type="checkbox" id="useLunar" class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
            <label for="useLunar" class="ml-2 block text-sm text-gray-900">农历周期</label>
          </div>
           <div class="flex items-center">
            <input type="checkbox" id="showLunar" checked class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
            <label for="showLunar" class="ml-2 block text-sm text-gray-900">显示农历</label>
          </div>
          <button type="button" id="calculateExpiryBtn" class="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 transition">
            <i class="fas fa-calculator mr-1"></i>推算到期日
          </button>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">备注信息</label>
          <textarea id="notes" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">提醒设置 (天)</label>
            <input type="number" id="reminderDays" min="0" value="7" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" title="提前多少天提醒，0表示仅当天提醒">
          </div>
          <div class="flex items-end space-x-4 pb-2">
            <div class="flex items-center">
              <input type="checkbox" id="autoRenew" checked class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
              <label for="autoRenew" class="ml-2 block text-sm text-gray-900">自动续期</label>
            </div>
            <div class="flex items-center">
              <input type="checkbox" id="isActive" checked class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
              <label for="isActive" class="ml-2 block text-sm text-gray-900">启用状态</label>
            </div>
          </div>
        </div>
        
        <div class="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <button type="button" id="cancelBtn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition duration-150">取消</button>
          <button type="submit" class="btn-primary px-6 py-2 text-white rounded-lg shadow-md font-medium">保存订阅</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    // Lunar Calendar Logic
    const lunarCalendar = {
      lunarInfo: [0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, 0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, 0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, 0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, 0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, 0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0, 0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, 0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6, 0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, 0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0, 0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, 0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, 0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, 0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, 0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0],
      gan: ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'],
      zhi: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'],
      months: ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'],
      days: ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'],
      
      lunarYearDays: function(year) {
        let sum = 348;
        for (let i = 0x8000; i > 0x8; i >>= 1) sum += (this.lunarInfo[year - 1900] & i) ? 1 : 0;
        return sum + this.leapDays(year);
      },
      leapDays: function(year) {
        if (this.leapMonth(year)) return (this.lunarInfo[year - 1900] & 0x10000) ? 30 : 29;
        return 0;
      },
      leapMonth: function(year) {
        return (this.lunarInfo[year - 1900] & 0xf);
      },
      monthDays: function(year, month) {
        return (this.lunarInfo[year - 1900] & (0x10000 >> month)) ? 30 : 29;
      },
      solar2lunar: function(year, month, day) {
        if (year < 1900 || year > 2100) return -1;
        let offset = (Date.UTC(year, month - 1, day) - Date.UTC(1900, 0, 31)) / 86400000;
        let temp = 0, i = 1900;
        for (i = 1900; i < 2101 && offset > 0; i++) {
          temp = this.lunarYearDays(i);
          offset -= temp;
        }
        if (offset < 0) { offset += temp; i--; }
        
        let isLeap = false, leap = this.leapMonth(i);
        let lunarYear = i, lunarMonth = 1;
        
        for (lunarMonth = 1; lunarMonth < 13 && offset > 0; lunarMonth++) {
          if (leap > 0 && lunarMonth == (leap + 1) && isLeap == false) {
            --lunarMonth; isLeap = true; temp = this.leapDays(lunarYear);
          } else {
            temp = this.monthDays(lunarYear, lunarMonth);
          }
          if (isLeap == true && lunarMonth == (leap + 1)) isLeap = false;
          offset -= temp;
        }
        if (offset == 0 && leap > 0 && lunarMonth == leap + 1) if (isLeap) isLeap = false; else { isLeap = true; --lunarMonth; }
        if (offset < 0) { offset += temp; --lunarMonth; }
        
        return {
          year: lunarYear,
          month: lunarMonth,
          day: Math.round(offset + 1),
          isLeap: isLeap,
          yearStr: this.gan[(lunarYear - 4) % 10] + this.zhi[(lunarYear - 4) % 12],
          monthStr: (isLeap ? '闰' : '') + this.months[lunarMonth - 1] + '月',
          dayStr: this.days[Math.round(offset)],
          fullStr: this.gan[(lunarYear - 4) % 10] + this.zhi[(lunarYear - 4) % 12] + '年 ' + (isLeap ? '闰' : '') + this.months[lunarMonth - 1] + '月' + this.days[Math.round(offset)]
        };
      }
    };
    
    // Lunar Business Logic
    const lunarBiz = {
        lunar2solar: function(lunar) {
            let offset = 0;
            // Scan from 1900
            for (let i = 1900; i < lunar.year; i++) offset += lunarCalendar.lunarYearDays(i);
            let leap = lunarCalendar.leapMonth(lunar.year);
            for (let i = 1; i < lunar.month; i++) {
                offset += lunarCalendar.monthDays(lunar.year, i);
                if (leap > 0 && i === leap) offset += lunarCalendar.leapDays(lunar.year);
            }
            if (lunar.isLeap) offset += lunarCalendar.monthDays(lunar.year, lunar.month);
            offset += lunar.day - 1;
            
            const baseDate = new Date(Date.UTC(1900, 0, 31));
            const solarDate = new Date(baseDate.getTime() + offset * 86400000);
            return {
                year: solarDate.getUTCFullYear(),
                month: solarDate.getUTCMonth() + 1,
                day: solarDate.getUTCDate()
            };
        },
        addLunarPeriod: function(lunar, value, unit) {
            let { year, month, day, isLeap } = lunar;
            if (unit === 'year') {
                year += value;
            } else if (unit === 'month') {
                let total = month + value;
                year += Math.floor((total - 1) / 12);
                month = (total - 1) % 12 + 1;
            } else if (unit === 'day') {
                const solar = this.lunar2solar(lunar);
                const date = new Date(Date.UTC(solar.year, solar.month - 1, solar.day));
                date.setDate(date.getDate() + value);
                return lunarCalendar.solar2lunar(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
            }
            
            // Adjust day
            let leap = lunarCalendar.leapMonth(year);
            let maxDays = lunarCalendar.monthDays(year, month);
            if (isLeap && leap === month) maxDays = lunarCalendar.leapDays(year);
            if (day > maxDays) day = maxDays;
            
            return { year, month, day, isLeap: (isLeap && leap === month) };
        }
    };
    
    // UI Helpers
    function showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      toast.innerHTML = '<i class="fas ' + (type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle') + ' mr-2"></i>' + message;
      document.body.appendChild(toast);
      setTimeout(() => toast.classList.add('show'), 100);
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => document.body.removeChild(toast), 300);
      }, 3000);
    }
    
    // Custom Date Picker Class
    class CustomDatePicker {
      constructor(inputId, pickerId, calendarId, monthId, yearId, prevBtnId, nextBtnId) {
        this.input = document.getElementById(inputId);
        this.picker = document.getElementById(pickerId);
        this.calendar = document.getElementById(calendarId);
        this.monthEl = document.getElementById(monthId);
        this.yearEl = document.getElementById(yearId);
        this.prevBtn = document.getElementById(prevBtnId);
        this.nextBtn = document.getElementById(nextBtnId);
        
        this.currentDate = new Date();
        this.selectedDate = null;
        
        this.init();
      }
      
      init() {
        this.input.addEventListener('click', (e) => {
          e.stopPropagation();
          document.querySelectorAll('.calendar-popup').forEach(p => {
             if(p.id !== this.picker.id) p.classList.remove('show');
          });
          this.picker.classList.toggle('show');
          this.render();
        });
        
        this.picker.addEventListener('click', (e) => e.stopPropagation());
        
        this.prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.render();
        });
        
        this.nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.render();
        });
        
        document.addEventListener('click', (e) => {
            if (!this.picker.contains(e.target) && e.target !== this.input) {
                this.picker.classList.remove('show');
            }
        });
      }
      
      render() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        this.monthEl.textContent = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'][month];
        this.yearEl.textContent = year;
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        this.calendar.innerHTML = '';
        
        // Empty slots
        for (let i = 0; i < firstDay; i++) {
          const div = document.createElement('div');
          this.calendar.appendChild(div);
        }
        
        const today = new Date();
        
        for (let i = 1; i <= daysInMonth; i++) {
          const div = document.createElement('div');
          div.className = 'calendar-day';
          div.textContent = i;
          
          if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
            div.classList.add('today');
          }
          
          if (this.selectedDate && 
              year === this.selectedDate.getFullYear() && 
              month === this.selectedDate.getMonth() && 
              i === this.selectedDate.getDate()) {
            div.classList.add('selected');
          }
          
          // Lunar
          const lunar = lunarCalendar.solar2lunar(year, month + 1, i);
          if (lunar) {
            const lunarSpan = document.createElement('div');
            lunarSpan.className = 'lunar-text';
            lunarSpan.textContent = lunar.day === 1 ? lunar.monthStr : lunar.dayStr;
            div.appendChild(lunarSpan);
          }
          
          div.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectDate(new Date(year, month, i));
          });
          
          this.calendar.appendChild(div);
        }
      }
      
      selectDate(date) {
        this.selectedDate = date;
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        
        this.input.value = \`\${year}-\${month.toString().padStart(2, '0')}-\${day.toString().padStart(2, '0')}\`;
        
        const lunar = lunarCalendar.solar2lunar(year, month, day);
        const lunarDivId = this.input.id + 'Lunar';
        const lunarDiv = document.getElementById(lunarDivId);
        if (lunarDiv && lunar) {
          lunarDiv.textContent = \`农历: \${lunar.monthStr}\${lunar.dayStr}\`;
        }
        
        this.picker.classList.remove('show');
        this.render();
        
        // Trigger change event manually
        const event = new Event('change');
        this.input.dispatchEvent(event);
      }
      
      setDate(dateStr) {
        if (!dateStr) return;
        this.selectedDate = new Date(dateStr);
        this.currentDate = new Date(dateStr);
        this.input.value = dateStr;
        
        const lunarDivId = this.input.id + 'Lunar';
        const lunarDiv = document.getElementById(lunarDivId);
        if (lunarDiv) {
            const year = this.selectedDate.getFullYear();
            const month = this.selectedDate.getMonth() + 1;
            const day = this.selectedDate.getDate();
            const lunar = lunarCalendar.solar2lunar(year, month, day);
            if (lunar) lunarDiv.textContent = \`农历: \${lunar.monthStr}\${lunar.dayStr}\`;
        }
      }
      
      destroy() {
         // Placeholder for cleanup if needed
      }
    }

    // Initialize Global Variables
    let subscriptions = [];
    let startDatePicker, expiryDatePicker;

    // Load Subscriptions
    async function loadSubscriptions() {
      const tbody = document.getElementById('subscriptionList');
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10"><i class="fas fa-spinner fa-spin mr-2"></i>加载中...</td></tr>';
      
      try {
        const res = await fetch('/api/subscriptions');
        subscriptions = await res.json();
        
        renderSubscriptions();
        updateStats();
      } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-red-500">加载失败</td></tr>';
        showToast('加载失败', 'error');
      }
    }
    
    function renderSubscriptions() {
        const tbody = document.getElementById('subscriptionList');
        tbody.innerHTML = '';
        
        if (subscriptions.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-gray-500">暂无订阅，点击上方按钮添加</td></tr>';
          return;
        }
        
        subscriptions.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
        
        const now = new Date();
        const unitMap = { day: '天', month: '月', year: '年' };
        
        subscriptions.forEach(sub => {
          const tr = document.createElement('tr');
          const exp = new Date(sub.expiryDate);
          // Calculate diff ignoring time
          const today = new Date();
          today.setHours(0,0,0,0);
          const expDay = new Date(exp);
          expDay.setHours(0,0,0,0);
          const diff = Math.ceil((expDay - today) / (1000 * 60 * 60 * 24));
          
          let statusHtml = '';
          if (sub.isActive === false) statusHtml = '<span class="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-800">已停用</span>';
          else if (diff < 0) statusHtml = '<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">已过期</span>';
          else if (diff <= (sub.reminderDays || 7)) statusHtml = '<span class="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">即将到期</span>';
          else statusHtml = '<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">正常</span>';
          
          const dateStr = exp.toISOString().split('T')[0];
          
          tr.innerHTML = \`
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">\${sub.name}</div>
                \${sub.notes ? \`<div class="text-xs text-gray-500">\${sub.notes}</div>\` : ''}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">\${sub.customType || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">\${sub.periodValue}\${unitMap[sub.periodUnit]}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              \${dateStr}
              <div class="text-xs text-gray-400">\${sub.useLunar ? '农历' : '公历'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">\${statusHtml}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
              <button onclick="openModal('\${sub.id}')" class="text-indigo-600 hover:text-indigo-900 mr-3"><i class="fas fa-edit"></i></button>
              <button onclick="toggleStatus('\${sub.id}', \${!sub.isActive})" class="text-blue-600 hover:text-blue-900 mr-3" title="\${sub.isActive ? '停用' : '启用'}">
                <i class="fas \${sub.isActive ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
              </button>
              <button onclick="deleteSubscription('\${sub.id}')" class="text-red-600 hover:text-red-900"><i class="fas fa-trash"></i></button>
              <button onclick="testNotify('\${sub.id}')" class="text-yellow-600 hover:text-yellow-900 ml-3" title="发送测试通知"><i class="fas fa-bell"></i></button>
            </td>
          \`;
          tbody.appendChild(tr);
        });
    }
    
    function updateStats() {
        const active = subscriptions.filter(s => s.isActive !== false).length;
        const total = subscriptions.length;
        
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const expiring = subscriptions.filter(s => {
          if (s.isActive === false) return false;
          const exp = new Date(s.expiryDate);
          exp.setHours(0,0,0,0);
          const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
          return diff >= 0 && diff <= 7;
        }).length;
        
        document.getElementById('totalCount').textContent = total;
        document.getElementById('activeCount').textContent = active;
        document.getElementById('expiringCount').textContent = expiring;
        document.getElementById('monthlyExpense').textContent = '¥0'; 
    }
    
    // Modal Functions
    async function openModal(id) {
      document.getElementById('subscriptionForm').reset();
      document.getElementById('subscriptionId').value = '';
      document.getElementById('modalTitle').textContent = '添加订阅';
      document.getElementById('startDate').value = new Date().toISOString().split('T')[0];
      
      // Default expiry +1 month
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      document.getElementById('expiryDate').value = nextMonth.toISOString().split('T')[0];
      
      document.getElementById('useLunar').checked = false;
      document.getElementById('showLunar').checked = true;
      document.getElementById('isActive').checked = true;
      document.getElementById('autoRenew').checked = true;
      document.getElementById('periodValue').value = 1;
      document.getElementById('periodUnit').value = 'month';
      document.getElementById('reminderDays').value = 7;
      
      if (id) {
          const sub = subscriptions.find(s => s.id === id);
          if (sub) {
             document.getElementById('modalTitle').textContent = '编辑订阅';
             document.getElementById('subscriptionId').value = sub.id;
             document.getElementById('name').value = sub.name;
             document.getElementById('customType').value = sub.customType || '';
             document.getElementById('notes').value = sub.notes || '';
             document.getElementById('isActive').checked = sub.isActive !== false;
             document.getElementById('autoRenew').checked = sub.autoRenew !== false;
             document.getElementById('startDate').value = sub.startDate ? sub.startDate.split('T')[0] : '';
             document.getElementById('expiryDate').value = sub.expiryDate.split('T')[0];
             document.getElementById('periodValue').value = sub.periodValue || 1;
             document.getElementById('periodUnit').value = sub.periodUnit || 'month';
             document.getElementById('reminderDays').value = sub.reminderDays !== undefined ? sub.reminderDays : 7;
             document.getElementById('useLunar').checked = !!sub.useLunar;
          }
      }
      
      document.getElementById('subscriptionModal').classList.remove('hidden');
      
      // Init Pickers
      setTimeout(() => {
        if (startDatePicker) startDatePicker.destroy();
        if (expiryDatePicker) expiryDatePicker.destroy();
        startDatePicker = new CustomDatePicker('startDate', 'startDatePicker', 'startDateCalendar', 'startDateMonth', 'startDateYear', 'startDatePrevMonth', 'startDateNextMonth');
        expiryDatePicker = new CustomDatePicker('expiryDate', 'expiryDatePicker', 'expiryDateCalendar', 'expiryDateMonth', 'expiryDateYear', 'expiryDatePrevMonth', 'expiryDateNextMonth');
        updateLunarDisplay('startDate', 'startDateLunar');
        updateLunarDisplay('expiryDate', 'expiryDateLunar');
        toggleLunarDisplay();
      }, 50);
    }
    
    document.getElementById('closeModal').addEventListener('click', () => {
      document.getElementById('subscriptionModal').classList.add('hidden');
    });
    
    document.getElementById('cancelBtn').addEventListener('click', () => {
      document.getElementById('subscriptionModal').classList.add('hidden');
    });
    
    // Form Submit
    document.getElementById('subscriptionForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('subscriptionId').value;
      const data = {
        name: document.getElementById('name').value,
        customType: document.getElementById('customType').value,
        notes: document.getElementById('notes').value,
        isActive: document.getElementById('isActive').checked,
        autoRenew: document.getElementById('autoRenew').checked,
        startDate: document.getElementById('startDate').value,
        expiryDate: document.getElementById('expiryDate').value,
        periodValue: parseInt(document.getElementById('periodValue').value),
        periodUnit: document.getElementById('periodUnit').value,
        reminderDays: parseInt(document.getElementById('reminderDays').value),
        useLunar: document.getElementById('useLunar').checked
      };
      
      const btn = e.target.querySelector('button[type="submit"]');
      const orgHtml = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>保存中...';
      btn.disabled = true;
      
      try {
        const url = id ? '/api/subscriptions/' + id : '/api/subscriptions';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        const result = await res.json();
        
        if (result.success || res.status === 200 || res.status === 201) {
          showToast('保存成功', 'success');
          document.getElementById('subscriptionModal').classList.add('hidden');
          loadSubscriptions();
        } else {
          showToast('保存失败: ' + (result.message || '未知错误'), 'error');
        }
      } catch (err) {
        showToast('保存失败', 'error');
      } finally {
        btn.innerHTML = orgHtml;
        btn.disabled = false;
      }
    });
    
    // Actions
    async function deleteSubscription(id) {
      if (!confirm('确定要删除吗？')) return;
      try {
        const res = await fetch('/api/subscriptions/' + id, { method: 'DELETE' });
        const result = await res.json();
        if (result.success || res.ok) {
          showToast('删除成功', 'success');
          loadSubscriptions();
        } else {
          showToast('删除失败', 'error');
        }
      } catch (err) {
        showToast('删除失败', 'error');
      }
    }
    
    async function toggleStatus(id, isActive) {
      try {
        const res = await fetch('/api/subscriptions/' + id + '/toggle-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive })
        });
        const result = await res.json();
        if (result.success) {
          showToast('状态更新成功', 'success');
          loadSubscriptions();
        } else {
          showToast('更新失败', 'error');
        }
      } catch (error) {
        showToast('更新失败', 'error');
      }
    }
    
    async function testNotify(id) {
        try {
            showToast('发送测试通知...', 'info');
            const res = await fetch('/api/subscriptions/' + id + '/test-notify', { method: 'POST' });
            const result = await res.json();
            if (result.success) {
                showToast('测试通知已发送', 'success');
            } else {
                showToast(result.message || '发送失败', 'error');
            }
        } catch (e) {
            showToast('发送失败', 'error');
        }
    }
    
    // Helpers
    function updateLunarDisplay(inputId, displayId) {
      const dateStr = document.getElementById(inputId).value;
      if (!dateStr) return;
      const date = new Date(dateStr);
      const lunar = lunarCalendar.solar2lunar(date.getFullYear(), date.getMonth() + 1, date.getDate());
      if (lunar !== -1) {
        document.getElementById(displayId).textContent = lunar.fullStr;
      }
    }
    
    function toggleLunarDisplay() {
      const show = document.getElementById('showLunar').checked;
      const displays = document.querySelectorAll('#startDateLunar, #expiryDateLunar, .lunar-text');
      displays.forEach(el => el.style.display = show ? 'block' : 'none');
    }
    
    function calculateExpiryDate() {
      const startStr = document.getElementById('startDate').value;
      const val = parseInt(document.getElementById('periodValue').value);
      const unit = document.getElementById('periodUnit').value;
      const useLunar = document.getElementById('useLunar').checked;
      
      if (!startStr || !val) return;
      
      const startDate = new Date(startStr);
      let expiryDate;
      
      if (useLunar) {
        const lunar = lunarCalendar.solar2lunar(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
        if (lunar === -1) return;
        const nextLunar = lunarBiz.addLunarPeriod(lunar, val, unit);
        const solar = lunarBiz.lunar2solar(nextLunar);
        expiryDate = new Date(Date.UTC(solar.year, solar.month - 1, solar.day));
      } else {
        expiryDate = new Date(startDate);
        if (unit === 'day') expiryDate.setDate(expiryDate.getDate() + val);
        else if (unit === 'month') expiryDate.setMonth(expiryDate.getMonth() + val);
        else if (unit === 'year') expiryDate.setFullYear(expiryDate.getFullYear() + val);
      }
      
      document.getElementById('expiryDate').value = expiryDate.toISOString().split('T')[0];
      updateLunarDisplay('expiryDate', 'expiryDateLunar');
    }
    
    // Init
    document.addEventListener('DOMContentLoaded', () => {
      loadSubscriptions();
      
      // Event Listeners
      ['startDate', 'periodValue', 'periodUnit', 'useLunar'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('change', calculateExpiryDate);
      });
      document.getElementById('calculateExpiryBtn').addEventListener('click', calculateExpiryDate);
      document.getElementById('showLunar').addEventListener('change', toggleLunarDisplay);
      
      // Timezone check
      setInterval(() => {
        const last = localStorage.getItem('timezoneUpdated');
        if (last && Date.now() - parseInt(last) < 5000) {
          localStorage.removeItem('timezoneUpdated');
          location.reload();
        }
      }, 2000);
      
      // System Time
      function updateTime() {
        const el = document.getElementById('systemTimeDisplay');
        if(el) el.textContent = new Date().toLocaleString();
      }
      updateTime();
      setInterval(updateTime, 1000);
    });
  </script>
</body>
</html>
`;
