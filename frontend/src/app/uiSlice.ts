import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  locale: 'ar' | 'en';
  direction: 'rtl' | 'ltr';
}

const initialState: UiState = {
  sidebarCollapsed: false,
  mobileMenuOpen: false,
  locale:           'ar',
  direction:        'rtl',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setMobileMenu(state, action: PayloadAction<boolean>) {
      state.mobileMenuOpen = action.payload;
      if (action.payload) state.sidebarCollapsed = false;
    },
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setLocale(state, action: PayloadAction<'ar' | 'en'>) {
      state.locale    = action.payload;
      state.direction = action.payload === 'ar' ? 'rtl' : 'ltr';
    },
  },
});

export const { toggleSidebar, setLocale, setMobileMenu } = uiSlice.actions;
export default uiSlice.reducer;
