import { findOnlineMeeting } from './online-meeting';

const GOOGLE_DELIMITER =
  '-::~:~::~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~::~:~::-';
const TEAMS_LINE = '_'.repeat(80);

/** A Google Calendar event with Meet, as iOS EventKit returns it for a Google account (November 2026). */
const GOOGLE_MEET_NOTES = [
  '- <a href="https://www.notion.so/Weekly-Standup">https://www.notion.so/Weekly-Standup</a>',
  '',
  GOOGLE_DELIMITER,
  'Join with Google Meet: https://meet.google.com/abc-defg-hij',
  'Or dial: (AT) +43 1 2345678 PIN: 123456789#',
  'More phone numbers: https://tel.meet/abc-defg-hij?pin=1234567890123&hs=7',
  '',
  'Learn more about Meet at: https://support.google.com/a/users/answer/9282720',
  '',
  'Please do not edit this section.',
  GOOGLE_DELIMITER,
].join('\n');

/** An Outlook/Teams invitation body, shaped like a real 2024 `.ics` (ids replaced). */
const TEAMS_DESCRIPTION = [
  'Austausch zu den Anwendungsfällen.',
  '',
  TEAMS_LINE,
  'Microsoft Teams Need help? <https://aka.ms/JoinTeamsMeeting?omkt=en-US>',
  'Join the meeting now <https://teams.microsoft.com/l/meetup-join/19%3ameeting_ABC%40thread.v2/0?context=%7b%22Tid%22%3a%22t-1%22%7d>',
  'Meeting ID: 379 444 982 595',
  'Passcode: foEAsN',
  '________________________________',
  '',
  'For organizers: Meeting options <https://teams.microsoft.com/meetingOptions/?organizerId=o-1>',
  TEAMS_LINE,
].join('\n');

describe('findOnlineMeeting', () => {
  describe('Google Meet block', () => {
    it('finds the join link and the dial-in, and removes the block from the description', () => {
      const details = findOnlineMeeting({ description: GOOGLE_MEET_NOTES, location: null });

      expect(details.meeting).toEqual({
        provider: 'google-meet',
        joinUrl: 'https://meet.google.com/abc-defg-hij',
        dialIn: {
          number: '+43 1 2345678',
          pin: '123456789',
          telUrl: 'tel:+4312345678;123456789%23',
        },
      });
      expect(details.description).toBe(
        '- <a href="https://www.notion.so/Weekly-Standup">https://www.notion.so/Weekly-Standup</a>',
      );
    });

    it('does not depend on the English labels', () => {
      const translated = GOOGLE_MEET_NOTES.replace(
        'Join with Google Meet',
        'Mit Google Meet teilnehmen',
      )
        .replace('Or dial', 'Oder wählen Sie')
        .replace(
          'Please do not edit this section.',
          'Bitte bearbeiten Sie diesen Abschnitt nicht.',
        );

      const details = findOnlineMeeting({ description: translated, location: null });

      expect(details.meeting?.joinUrl).toBe('https://meet.google.com/abc-defg-hij');
      expect(details.description).not.toContain('Abschnitt');
    });

    it('leaves the description as it is when a delimiter has no partner', () => {
      const unpaired = GOOGLE_MEET_NOTES.slice(0, GOOGLE_MEET_NOTES.lastIndexOf(GOOGLE_DELIMITER));

      const details = findOnlineMeeting({ description: unpaired, location: null });

      expect(details.description).toBe(unpaired.trim());
      expect(details.meeting).toMatchObject({ provider: 'google-meet', dialIn: null });
    });

    it('leaves a block without a Meet link untouched', () => {
      const description = `Agenda\n${GOOGLE_DELIMITER}\nkein Link\n${GOOGLE_DELIMITER}`;

      expect(findOnlineMeeting({ description, location: null })).toEqual({
        meeting: null,
        description,
        location: null,
      });
    });
  });

  describe('Microsoft Teams', () => {
    it('takes the join link from the underscore-framed block and hides the location that only names it', () => {
      const details = findOnlineMeeting({
        description: TEAMS_DESCRIPTION,
        location: 'Microsoft Teams Meeting',
      });

      expect(details.meeting).toEqual({
        provider: 'microsoft-teams',
        joinUrl:
          'https://teams.microsoft.com/l/meetup-join/19%3ameeting_ABC%40thread.v2/0?context=%7b%22Tid%22%3a%22t-1%22%7d',
        dialIn: null,
      });
      expect(details.description).toBe('Austausch zu den Anwendungsfällen.');
      expect(details.location).toBeNull();
    });

    it('recognises the short join link and unwraps Outlook Safe Links', () => {
      const wrapped = `https://eur01.safelinks.protection.outlook.com/?url=${encodeURIComponent(
        'https://teams.microsoft.com/meet/3693943849166?p=yRZD02',
      )}&data=x`;

      const details = findOnlineMeeting({ description: `Join: ${wrapped}`, location: null });

      expect(details.meeting?.joinUrl).toBe(
        'https://teams.microsoft.com/meet/3693943849166?p=yRZD02',
      );
    });

    it('does not take the help or meeting-options links for a join link', () => {
      const description =
        'Need help? <https://aka.ms/JoinTeamsMeeting> Meeting options <https://teams.microsoft.com/meetingOptions/?x=1>';

      expect(findOnlineMeeting({ description, location: null }).meeting).toBeNull();
    });
  });

  describe('Zoom and Webex', () => {
    it('takes a Zoom link from the location and hides the location that only repeats it', () => {
      const details = findOnlineMeeting({
        description: 'Bitte pünktlich.',
        location: 'https://us02web.zoom.us/j/98765432101?pwd=abc.1',
      });

      expect(details.meeting).toEqual({
        provider: 'zoom',
        joinUrl: 'https://us02web.zoom.us/j/98765432101?pwd=abc.1',
        dialIn: null,
      });
      expect(details.location).toBeNull();
      expect(details.description).toBe('Bitte pünktlich.');
    });

    it('keeps a location that says more than the link', () => {
      const location = 'Raum 3 / https://us02web.zoom.us/j/98765432101';

      expect(findOnlineMeeting({ description: null, location }).location).toBe(location);
    });

    it('cuts a Webex block to the end and builds the one-tap dial-in', () => {
      const description = [
        'Quartalsrunde',
        '-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-',
        '-- Do not delete or change any of the following text. --',
        'Join meeting: https://acme.webex.com/acme/j.php?MTID=m0123456789abcdef',
        'Tap to join from a mobile device: +43-1-2345-6789,,26512345678## Austria Toll',
      ].join('\n');

      const details = findOnlineMeeting({ description, location: null });

      expect(details.meeting).toEqual({
        provider: 'webex',
        joinUrl: 'https://acme.webex.com/acme/j.php?MTID=m0123456789abcdef',
        dialIn: {
          number: '+43-1-2345-6789',
          pin: null,
          telUrl: 'tel:+43123456789,,26512345678%23%23',
        },
      });
      expect(details.description).toBe('Quartalsrunde');
    });

    it('builds a dial-in from a Zoom one-tap line inside the extension block', () => {
      const line = '─'.repeat(20);
      const description = [
        'Treffen',
        line,
        'Join Zoom Meeting https://zoom.us/j/98765432101?pwd=abc',
        'One tap mobile +4319284090,,98765432101#,,,,*123456# Austria',
        line,
      ].join('\n');

      expect(findOnlineMeeting({ description, location: null }).meeting?.dialIn).toEqual({
        number: '+4319284090',
        pin: null,
        telUrl: 'tel:+4319284090,,98765432101%23,,,,*123456%23',
      });
    });
  });

  describe('free text', () => {
    it('finds a known provider link anywhere in the description, in an href too', () => {
      const description =
        'Unterlagen: <a href="https://example.org/agenda">Agenda</a>, Raum: <a href="https://meet.jit.si/RebellinnenPlenum">hier</a>';

      expect(findOnlineMeeting({ description, location: null }).meeting).toEqual({
        provider: 'jitsi',
        joinUrl: 'https://meet.jit.si/RebellinnenPlenum',
        dialIn: null,
      });
    });

    it('unwraps a Google redirect and decodes HTML entities in a link', () => {
      const description =
        '<a href="https://www.google.com/url?q=https://us02web.zoom.us/j/123?pwd%3Dx&amp;sa=D">Zoom</a>';

      expect(findOnlineMeeting({ description, location: null }).meeting?.joinUrl).toBe(
        'https://us02web.zoom.us/j/123?pwd=x',
      );
    });

    it('does not take unrelated links or other Google pages for a meeting', () => {
      const description =
        'https://www.notion.so/x https://support.google.com/a/users/answer/9282720 https://zoom.us/pricing https://meet.google.com/';

      expect(findOnlineMeeting({ description, location: null }).meeting).toBeNull();
    });

    it('leaves an event without a meeting as it is', () => {
      expect(findOnlineMeeting({ description: '  Plenum  ', location: 'Vereinslokal' })).toEqual({
        meeting: null,
        description: 'Plenum',
        location: 'Vereinslokal',
      });
      expect(findOnlineMeeting({ description: null, location: null })).toEqual({
        meeting: null,
        description: null,
        location: null,
      });
    });
  });
});
