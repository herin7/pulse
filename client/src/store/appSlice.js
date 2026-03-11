import { createSlice } from '@reduxjs/toolkit';

const appSlice = createSlice({
    name: 'app',
    initialState: {
        screen: 'onboarding',      // 'onboarding' | 'ingesting' | 'chat'
        formData: null,
        characterCard: null,
        sessionChecked: false,
    },
    reducers: {
        setScreen(state, action) {
            state.screen = action.payload;
        },
        setFormData(state, action) {
            state.formData = action.payload;
        },
        setCharacterCard(state, action) {
            state.characterCard = action.payload;
        },
        sessionLoaded(state, action) {
            // action.payload = { exists, userId, characterCard }
            state.sessionChecked = true;
            if (action.payload.exists) {
                state.characterCard = action.payload.characterCard;
                state.screen = 'chat';
            }
        },
        resetSession(state) {
            state.screen = 'onboarding';
            state.formData = null;
            state.characterCard = null;
            state.sessionChecked = false;
        },
    },
});

export const {
    setScreen,
    setFormData,
    setCharacterCard,
    sessionLoaded,
    resetSession,
} = appSlice.actions;

export default appSlice.reducer;
