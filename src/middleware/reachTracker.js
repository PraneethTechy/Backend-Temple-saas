import crypto from 'crypto';
import SiteReachMetric from '../models/SiteReachMetric.js';

/**
 * Lightweight, non-blocking reach tracking middleware for public client requests.
 * Tracks actual daily unique visitors and pageviews without collecting PII.
 */
export const trackSiteReach = (req, res, next) => {
  try {
    // Only track GET requests that hit public client APIs (exclude admin, authority, healthcheck, static)
    if (
      req.method === 'GET' &&
      !req.path.startsWith('/admin') &&
      !req.path.startsWith('/authority') &&
      !req.path.includes('/health')
    ) {
      const today = new Date().toISOString().slice(0, 10);
      const rawIp =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        req.ip ||
        '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'generic-client';

      const visitorHash = crypto
        .createHash('sha256')
        .update(`${rawIp}-${userAgent}`)
        .digest('hex')
        .slice(0, 16);

      // Asynchronous background update to avoid blocking API responses
      SiteReachMetric.findOneAndUpdate(
        { date: today },
        {
          $inc: { pageViews: 1 },
          $addToSet: { uniqueVisitors: visitorHash },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
        .then((doc) => {
          if (doc && doc.uniqueVisitors) {
            const count = doc.uniqueVisitors.length;
            if (doc.visitorCount !== count) {
              doc.visitorCount = count;
              doc.save().catch(() => {});
            }
          }
        })
        .catch(() => {});
    }
  } catch (err) {
    // Never fail request processing if tracking errors
  }
  next();
};

export default trackSiteReach;
