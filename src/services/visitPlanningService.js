/**
 * Visit Planning Deterministic Engine
 *
 * Rules:
 * - Deterministic, verified calculations only.
 * - AI/LLM must NEVER calculate distance, duration, arrival time, or departure time.
 * - Configurable buffers:
 *   - ARRIVAL_BUFFER_MINUTES: Devotee should arrive 30 minutes before slot start.
 *   - SHORT_TRIP_BUFFER_MINUTES: 30 minutes safety buffer for trips < 200 km.
 *   - LONG_TRIP_BUFFER_MINUTES: 60 minutes safety buffer for trips >= 200 km.
 */

export const ARRIVAL_BUFFER_MINUTES = 30;
export const SHORT_TRIP_BUFFER_MINUTES = 30;
export const LONG_TRIP_BUFFER_MINUTES = 60;

/**
 * Format a Date object into a readable 12-hour time string with date
 * e.g., "06:30 AM (12 Oct 2026)" or "09:30 PM (11 Oct 2026)"
 */
export const formatDateTimeDisplay = (date) => {
  if (!date || isNaN(date.getTime())) return '';

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
  const timeStr = `${formattedHours < 10 ? '0' : ''}${formattedHours}:${formattedMinutes} ${ampm}`;

  const day = date.getDate();
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  return `${timeStr} (${day} ${month} ${year})`;
};

/**
 * Format only the 12-hour time part
 * e.g., "07:00 AM"
 */
export const formatTimeDisplay = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
  return `${formattedHours < 10 ? '0' : ''}${formattedHours}:${formattedMinutes} ${ampm}`;
};

/**
 * Calculate deterministic visit schedule
 *
 * @param {Object} params
 * @param {Date|string} params.bookingDate - The calendar date of the booking
 * @param {string} params.slotStartTime - Slot start time in "HH:mm" (24-hour)
 * @param {number} params.distanceMeters - Distance in meters from Google Route
 * @param {number} params.durationSeconds - Driving duration in seconds from Google Route
 * @returns {Object} Deterministic planning schedule
 */
export const calculateVisitSchedule = ({
  bookingDate,
  slotStartTime,
  distanceMeters = 0,
  durationSeconds = 0,
}) => {
  // Parse slot start time (e.g. "07:00" -> 7 hours, 0 minutes)
  const [slotHStr, slotMStr] = (slotStartTime || '07:00').split(':');
  const slotHours = parseInt(slotHStr, 10) || 7;
  const slotMinutes = parseInt(slotMStr, 10) || 0;

  // Build slot start Date object
  const bDate = new Date(bookingDate);
  const slotStartDate = new Date(
    bDate.getFullYear(),
    bDate.getMonth(),
    bDate.getDate(),
    slotHours,
    slotMinutes,
    0,
    0
  );

  // 1. Recommended Arrival: slotStart - ARRIVAL_BUFFER_MINUTES
  const recommendedArrivalAt = new Date(
    slotStartDate.getTime() - ARRIVAL_BUFFER_MINUTES * 60 * 1000
  );

  // 2. Safety buffer based on distance (30 mins for < 200km, 60 mins for >= 200km)
  const isLongTrip = distanceMeters >= 200000;
  const safetyBufferMinutes = isLongTrip ? LONG_TRIP_BUFFER_MINUTES : SHORT_TRIP_BUFFER_MINUTES;

  // 3. Recommended Departure: recommendedArrival - drivingDuration - safetyBuffer
  const travelDurationMs = (durationSeconds || 0) * 1000;
  const safetyBufferMs = safetyBufferMinutes * 60 * 1000;
  const recommendedDepartureAt = new Date(
    recommendedArrivalAt.getTime() - travelDurationMs - safetyBufferMs
  );

  // Friendly formatted strings
  const recommendedArrivalText = formatDateTimeDisplay(recommendedArrivalAt);
  const recommendedDepartureText = formatDateTimeDisplay(recommendedDepartureAt);
  const arrivalTimeOnly = formatTimeDisplay(recommendedArrivalAt);
  const departureTimeOnly = formatTimeDisplay(recommendedDepartureAt);
  const slotTimeOnly = formatTimeDisplay(slotStartDate);

  // Explanation callout string matching reference UI
  const departureDay = recommendedDepartureAt.getDate();
  const departureMonth = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ][recommendedDepartureAt.getMonth()];
  const departureYear = recommendedDepartureAt.getFullYear();

  const explanationCallout = `To reach on time for your ${slotTimeOnly} darshan, we recommend starting around ${departureTimeOnly} on ${departureDay} ${departureMonth} ${departureYear}, considering current traffic conditions.`;

  return {
    arrivalBufferMinutes: ARRIVAL_BUFFER_MINUTES,
    safetyBufferMinutes,
    recommendedArrivalAt,
    recommendedDepartureAt,
    recommendedArrivalText,
    recommendedDepartureText,
    arrivalTimeOnly,
    departureTimeOnly,
    explanationCallout,
  };
};

export default {
  calculateVisitSchedule,
  formatDateTimeDisplay,
  formatTimeDisplay,
  ARRIVAL_BUFFER_MINUTES,
  SHORT_TRIP_BUFFER_MINUTES,
  LONG_TRIP_BUFFER_MINUTES,
};
