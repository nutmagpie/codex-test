import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { ArrowRight, Check, ChevronRight, Pencil, Plus, Smartphone, Sparkles, Trash2, Users, X } from 'lucide-react-native';
import {
  addProfile, AVATARS, deleteProfile, getActiveProfile, PROFILE_COLORS, selectProfile,
  type AppState, type Profile,
} from './profiles';
import { Button, C, Label, Pill, T } from './ui';

type Editor = { id: string | null; name: string; avatar: string; color: string };

function avatarEmoji(profile: Pick<Profile, 'avatar'>): string {
  return AVATARS.find((avatar) => avatar.id === profile.avatar)?.emoji ?? AVATARS[0].emoji;
}

function masteredCount(profile: Profile): number {
  return Object.values(profile.progress).filter((level) => level.mastery).length;
}

function Avatar({ profile, size = 54 }: { profile: Pick<Profile, 'avatar' | 'color'>; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size * .32, backgroundColor: profile.color, alignItems: 'center', justifyContent: 'center' }}>
    <T style={{ fontSize: size * .49 }} accessible={false}>{avatarEmoji(profile)}</T>
  </View>;
}

export function FamilyScreen({ state, onChange, wide }: {
  state: AppState; onChange: (state: AppState) => void; wide: boolean;
}) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const active = getActiveProfile(state);

  function openEditor(profile?: Profile) {
    setConfirmDelete(null);
    setError('');
    setEditor({
      id: profile?.id ?? null,
      name: profile?.name ?? '',
      avatar: profile?.avatar ?? AVATARS[state.profiles.length % AVATARS.length].id,
      color: profile?.color ?? PROFILE_COLORS[state.profiles.length % PROFILE_COLORS.length],
    });
  }

  function saveProfile() {
    if (!editor) return;
    const name = editor.name.trim();
    if (!name || name.length > 20) {
      setError('A name with 1–20 characters will do nicely.');
      return;
    }
    if (editor.id) {
      onChange({
        ...state,
        profiles: state.profiles.map((profile) => profile.id === editor.id
          ? { ...profile, name, avatar: editor.avatar, color: editor.color } : profile),
      });
    } else {
      onChange(addProfile(state, name, editor.avatar, editor.color));
    }
    setEditor(null);
    setError('');
  }

  function removeProfile(id: string) {
    if (state.profiles.length <= 1) return;
    onChange(deleteProfile(state, id));
    if (editor?.id === id) setEditor(null);
    setConfirmDelete(null);
  }

  return <View style={s.screen}>
    <View style={s.heading}>
      <Label color={C.green}>THE FAMILY CORNER</Label>
      <T weight="display" style={[s.title, { fontSize: wide ? 44 : 33 }]}>Room for every{wide ? '\n' : ' '}curious mind.</T>
      <T style={s.intro}>Different players. Their own little wins.{wide ? '\n' : ' '}A shared place to grow.</T>
    </View>

    <View style={[s.columns, { flexDirection: wide ? 'row' : 'column' }]}>
      <View style={{ flex: wide ? 1.65 : undefined, gap: 16 }}>
        <View style={s.sectionHeading}>
          <View style={{ gap: 5 }}><Label>YOUR PLAYERS</Label><T style={s.sectionHint}>{state.profiles.length} {state.profiles.length === 1 ? 'curious mind' : 'curious minds'} and counting</T></View>
          <Button title="Add player" icon={Plus} variant="secondary" onPress={() => openEditor()} testID="add-profile" style={{ paddingHorizontal: 14 }} />
        </View>

        {state.profiles.map((profile) => {
          const isActive = profile.id === active?.id;
          const mastered = masteredCount(profile);
          return <View key={profile.id} style={[s.profileCard, isActive && { borderColor: '#B5D6B7' }]}>
            <View style={s.playerRow}>
              <Avatar profile={profile} />
              <View style={{ flex: 1, gap: 5 }}>
                <View style={s.playerName}><T weight="bold" style={{ fontSize: 18, flexShrink: 1 }}>{profile.name}</T>{isActive && <Pill color={C.mint} ink={C.green}>PLAYING NOW</Pill>}</View>
                <T style={{ color: C.muted, fontSize: 12 }}>{mastered} {mastered === 1 ? 'level' : 'levels'} mastered · {profile.history.length} recent {profile.history.length === 1 ? 'run' : 'runs'}</T>
              </View>
            </View>
            <View style={s.profileActions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${profile.name}`} onPress={() => openEditor(profile)} style={({ pressed }) => [s.smallAction, { opacity: pressed ? .65 : 1 }]}>
                <Pencil size={15} color={C.muted} /><T style={s.actionText}>Edit</T>
              </Pressable>
              {state.profiles.length > 1 && <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${profile.name}`} onPress={() => { setConfirmDelete(profile.id); setEditor(null); }} style={({ pressed }) => [s.smallAction, { opacity: pressed ? .65 : 1 }]}>
                <Trash2 size={15} color={C.muted} /><T style={s.actionText}>Remove</T>
              </Pressable>}
              <View style={{ flex: 1 }} />
              {isActive ? <View style={s.activeMarker}><Check size={15} color={C.green} /><T weight="bold" style={{ fontSize: 12, color: C.green }}>Ready to play</T></View>
                : <Button title="Switch" variant="ghost" icon={ArrowRight} onPress={() => { onChange(selectProfile(state, profile.id)); setConfirmDelete(null); }} testID={`select-profile-${profile.id}`} style={{ minHeight: 44, paddingVertical: 8, paddingHorizontal: 15 }} />}
            </View>
            {confirmDelete === profile.id && <View style={s.confirmBox}>
              <T weight="bold" style={{ fontSize: 14 }}>Remove {profile.name}?</T>
              <T style={{ color: C.muted, fontSize: 12, lineHeight: 19 }}>Their saved progress will be removed from this device. This cannot be undone.</T>
              <View style={{ flexDirection: wide ? 'row' : 'column', gap: 10 }}>
                <Button title="Keep player" variant="ghost" onPress={() => setConfirmDelete(null)} style={{ flex: wide ? 1 : undefined }} />
                <Button title="Remove player" onPress={() => removeProfile(profile.id)} style={{ flex: wide ? 1 : undefined, backgroundColor: '#A64B36' }} />
              </View>
            </View>}
          </View>;
        })}

        {editor && <View style={s.editor}>
          <View style={s.sectionHeading}>
            <View style={{ gap: 6 }}><Label color={C.green}>{editor.id ? 'A LITTLE REFRESH' : 'MEET YOUR NEXT PLAYER'}</Label><T weight="display" style={{ fontSize: 24 }}>{editor.id ? 'Make it feel like you.' : 'Every mind belongs.'}</T></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close player form" onPress={() => setEditor(null)} style={s.iconButton}><X size={19} color={C.ink} /></Pressable>
          </View>
          <View style={{ gap: 8 }}>
            <T weight="bold" style={{ fontSize: 13 }}>Player name</T>
            <TextInput
              value={editor.name}
              onChangeText={(name) => { setEditor({ ...editor, name }); setError(''); }}
              placeholder="What should we call you?"
              placeholderTextColor={C.muted}
              maxLength={20}
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={saveProfile}
              accessibilityLabel="Player name"
              testID="profile-name-input"
              style={s.input}
            />
            <T style={{ color: error ? '#A64B36' : C.muted, fontSize: 12 }} accessibilityLiveRegion="polite">{error || 'A first name or nickname. Up to 20 characters.'}</T>
          </View>
          <View style={{ gap: 10 }}>
            <T weight="bold" style={{ fontSize: 13 }}>Pick your little sidekick</T>
            <View style={s.options}>{AVATARS.map((avatar) => <Pressable key={avatar.id} accessibilityRole="button" accessibilityLabel={`${avatar.label} avatar`} accessibilityState={{ selected: editor.avatar === avatar.id }} onPress={() => setEditor({ ...editor, avatar: avatar.id })} style={[s.avatarOption, { borderColor: editor.avatar === avatar.id ? C.ink : C.line, backgroundColor: editor.avatar === avatar.id ? C.mint : C.paper }]}><T style={{ fontSize: 25 }} accessible={false}>{avatar.emoji}</T></Pressable>)}</View>
          </View>
          <View style={{ gap: 10 }}>
            <T weight="bold" style={{ fontSize: 13 }}>And a favorite color</T>
            <View style={s.options}>{PROFILE_COLORS.map((color, index) => <Pressable key={color} accessibilityRole="button" accessibilityLabel={`${['Mint', 'Apricot', 'Sky', 'Lavender'][index]} profile color`} accessibilityState={{ selected: editor.color === color }} onPress={() => setEditor({ ...editor, color })} style={[s.colorOption, { backgroundColor: color, borderColor: editor.color === color ? C.ink : color }]}>{editor.color === color && <Check size={19} color={C.ink} />}</Pressable>)}</View>
          </View>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12 }}>
            <Button title="Cancel" variant="ghost" onPress={() => setEditor(null)} style={{ flex: wide ? 1 : undefined }} />
            <Button title={editor.id ? 'Save changes' : 'Let’s play'} icon={ArrowRight} onPress={saveProfile} testID="save-profile" style={{ flex: wide ? 1.4 : undefined }} />
          </View>
        </View>}
      </View>

      <View style={{ flex: wide ? 1 : undefined, gap: 16 }}>
        <View style={s.settingsCard}>
          <View style={s.roundIcon}><Sparkles size={23} color={C.green} /></View>
          <T weight="display" style={{ fontSize: 23 }}>Small touches.{ '\n' }Good feelings.</T>
          <T style={s.detail}>Make your practice feel just right.</T>
          <View style={s.settingRow}>
            <View style={{ flex: 1, gap: 5 }}><T weight="bold" style={{ fontSize: 14 }}>Gentle haptics</T><T style={{ fontSize: 12, color: C.muted, lineHeight: 18 }}>A little vibration on supported phones.</T></View>
            <Switch value={state.haptics} onValueChange={(haptics) => onChange({ ...state, haptics })} accessibilityLabel="Gentle haptics" trackColor={{ false: C.line, true: C.green }} thumbColor={C.paper} />
          </View>
        </View>
        <View style={s.privacyCard}>
          <Smartphone size={25} color={C.green} strokeWidth={1.6} />
          <Label color={C.green}>YOUR DEVICE. YOUR PROGRESS.</Label>
          <T weight="display" style={{ fontSize: 22 }}>A space of your own.</T>
          <T style={s.detail}>Profiles and progress are saved on this device. No account needed, and no cloud sync.</T>
          <View style={s.privacyDivider} />
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}><Users size={18} color={C.muted} /><T style={{ flex: 1, color: C.muted, fontSize: 12, lineHeight: 19 }}>Parents can add and manage players here. Family settings are open to anyone using the app.</T></View>
        </View>
      </View>
    </View>
  </View>;
}

export function ProfilePicker({ state, onChange, onClose, onFamily }: {
  state: AppState; onChange: (state: AppState) => void; onClose: () => void; onFamily: () => void;
}) {
  const active = getActiveProfile(state);
  return <View style={s.picker}>
    <View style={s.sectionHeading}>
      <View style={{ gap: 7 }}><Label color={C.green}>A LITTLE CHANGE OF PLAYER</Label><T weight="display" style={{ fontSize: 27 }}>Who’s up next?</T></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close player picker" onPress={onClose} style={s.iconButton}><X size={20} color={C.ink} /></Pressable>
    </View>
    <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: 10 }}>
      {state.profiles.map((profile) => {
        const isActive = profile.id === active?.id;
        const mastered = masteredCount(profile);
        return <Pressable key={profile.id} accessibilityRole="button" accessibilityLabel={`Play as ${profile.name}`} accessibilityState={{ selected: isActive }} testID={`select-profile-${profile.id}`} onPress={() => { onChange(selectProfile(state, profile.id)); onClose(); }} style={({ pressed }) => [s.pickerRow, { backgroundColor: isActive ? C.pale : C.paper, borderColor: isActive ? '#B5D6B7' : C.line, opacity: pressed ? .75 : 1 }]}>
          <Avatar profile={profile} size={46} />
          <View style={{ flex: 1, gap: 4 }}><T weight="bold" style={{ fontSize: 16 }}>{profile.name}</T><T style={{ color: C.muted, fontSize: 12 }}>{mastered} {mastered === 1 ? 'level' : 'levels'} mastered</T></View>
          {isActive ? <Check size={21} color={C.green} /> : <ChevronRight size={20} color={C.muted} />}
        </Pressable>;
      })}
    </ScrollView>
    <Button title="Manage players" icon={Users} variant="secondary" onPress={() => { onClose(); onFamily(); }} />
    <T style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>Their own pace. Their own progress.</T>
  </View>;
}

const s = StyleSheet.create({
  screen: { paddingBottom: 38, gap: 32 },
  heading: { gap: 13 },
  title: { letterSpacing: -1.7, lineHeight: 49, maxWidth: 660 },
  intro: { fontSize: 15, lineHeight: 23, color: C.muted },
  columns: { gap: 24, alignItems: 'stretch' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  sectionHint: { color: C.muted, fontSize: 12 },
  profileCard: { borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, borderRadius: 22, padding: 19, gap: 15 },
  playerRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  playerName: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  profileActions: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 },
  smallAction: { minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionText: { fontSize: 12, color: C.muted },
  activeMarker: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  confirmBox: { backgroundColor: '#FBF0E8', borderRadius: 15, padding: 15, gap: 10 },
  editor: { backgroundColor: C.paper, borderColor: '#B5D6B7', borderWidth: 1, borderRadius: 24, padding: 22, gap: 22 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 13, minHeight: 52, paddingHorizontal: 15, color: C.ink, backgroundColor: C.bg, fontSize: 16, fontFamily: 'DMSans_400Regular' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarOption: { width: 50, height: 50, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  colorOption: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  settingsCard: { padding: 24, backgroundColor: C.paper, borderRadius: 24, borderColor: C.line, borderWidth: 1, gap: 13 },
  roundIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: C.mint, borderRadius: 15, marginBottom: 3 },
  detail: { fontSize: 13, lineHeight: 21, color: C.muted },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingTop: 19, marginTop: 6, borderTopColor: C.line, borderTopWidth: 1 },
  privacyCard: { backgroundColor: C.pale, borderRadius: 24, padding: 24, gap: 13 },
  privacyDivider: { height: 1, backgroundColor: '#D6DDCF', marginVertical: 4 },
  picker: { gap: 21, width: '100%' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, borderWidth: 1, borderRadius: 18 },
});
