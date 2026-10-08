"""Pull every X bookmark via the web app's internal GraphQL endpoint and write bookmarks.json.

Needs the two session cookies X's own web client uses: AUTH_TOKEN and CT0 (env vars).
"""
import json, os, sys, time, urllib.parse, urllib.request

# ponytail: query id is what x.com's bundle used on 2026-10-06; if X rotates it, grep the
# new one from the Bookmarks request in DevTools and update here.
QUERY_ID = "qToeLeMs43Q8cr7tRYXmaQ"
BEARER = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"
FEATURES = {"graphql_timeline_v2_bookmark_timeline": True, "rweb_video_screen_enabled": False, "profile_label_improvements_pcf_label_in_post_enabled": True, "rweb_tipjar_consumption_enabled": True, "verified_phone_label_enabled": False, "creator_subscriptions_tweet_preview_api_enabled": True, "responsive_web_graphql_timeline_navigation_enabled": True, "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False, "premium_content_api_read_enabled": False, "communities_web_enable_tweet_community_results_fetch": True, "c9s_tweet_anatomy_moderator_badge_enabled": True, "responsive_web_grok_analyze_button_fetch_trends_enabled": False, "responsive_web_grok_analyze_post_followups_enabled": True, "responsive_web_jetfuel_frame": False, "responsive_web_grok_share_attachment_enabled": True, "articles_preview_enabled": True, "responsive_web_edit_tweet_api_enabled": True, "graphql_is_translatable_rweb_tweet_is_translatable_enabled": True, "view_counts_everywhere_api_enabled": True, "longform_notetweets_consumption_enabled": True, "responsive_web_twitter_article_tweet_consumption_enabled": True, "tweet_awards_web_tipping_enabled": False, "responsive_web_grok_show_grok_translated_post": False, "responsive_web_grok_analysis_button_from_backend": True, "creator_subscriptions_quote_tweet_preview_enabled": False, "freedom_of_speech_not_reach_fetch_enabled": True, "standardized_nudges_misinfo": True, "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": True, "longform_notetweets_rich_text_read_enabled": True, "longform_notetweets_inline_media_enabled": True, "responsive_web_grok_image_annotation_enabled": True, "responsive_web_enhance_cards_enabled": False}


def pick(entry):
    t = ((entry.get("content") or {}).get("itemContent") or {}).get("tweet_results", {}).get("result")
    if not t:
        return None
    t = t.get("tweet", t)
    if not t.get("rest_id"):  # tombstoned / unavailable tweet
        return None
    l = t.get("legacy") or {}
    u = ((t.get("core") or {}).get("user_results") or {}).get("result") or {}
    uc, ul = u.get("core") or {}, u.get("legacy") or {}
    handle = uc.get("screen_name") or ul.get("screen_name")
    note = (((t.get("note_tweet") or {}).get("note_tweet_results") or {}).get("result") or {}).get("text")
    return {
        "id": t.get("rest_id"),
        "url": f"https://x.com/{handle}/status/{t.get('rest_id')}",
        "author": uc.get("name") or ul.get("name"),
        "handle": handle,
        "created_at": l.get("created_at"),
        "text": note or l.get("full_text", ""),
        "media": [m["media_url_https"] for m in (l.get("extended_entities") or {}).get("media", [])],
        "urls": [x["expanded_url"] for x in (l.get("entities") or {}).get("urls", [])],
        "likes": l.get("favorite_count"),
    }


def page(auth_token, ct0, cursor):
    v = {"count": 100, "includePromotedContent": False}
    if cursor:
        v["cursor"] = cursor
    q = urllib.parse.urlencode({"variables": json.dumps(v), "features": json.dumps(FEATURES)})
    req = urllib.request.Request(f"https://x.com/i/api/graphql/{QUERY_ID}/Bookmarks?{q}", headers={
        "authorization": f"Bearer {BEARER}",
        "x-csrf-token": ct0,
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-active-user": "yes",
        "cookie": f"auth_token={auth_token}; ct0={ct0}",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            sys.exit(f"X rejected the login cookies (HTTP {e.code}). Copy fresh auth_token and ct0 cookies "
                     "from x.com into the AUTH_TOKEN and CT0 repo secrets.")
        raise
    instr = data["data"]["bookmark_timeline_v2"]["timeline"]["instructions"]
    entries = [e for i in instr for e in i.get("entries", [])]
    tweets = [x for x in (pick(e) for e in entries if e["entryId"].startswith("tweet-")) if x]
    nxt = next((e["content"]["value"] for e in entries if e["entryId"].startswith("cursor-bottom-")), None)
    return tweets, nxt


def main():
    auth_token, ct0 = os.environ.get("AUTH_TOKEN"), os.environ.get("CT0")
    if not auth_token or not ct0:
        sys.exit("AUTH_TOKEN / CT0 are empty. Add them under repo Settings > Secrets and variables > Actions.")
    out, cursor, stale = {}, None, 0  # X's pages overlap, so key by tweet id (dict keeps insertion order)
    while True:
        tweets, cursor = page(auth_token, ct0, cursor)
        new = [t for t in tweets if t["id"] not in out]
        out.update((t["id"], t) for t in new)
        stale = 0 if new else stale + 1
        print(f"{len(out)} bookmarks", file=sys.stderr)
        if not tweets or not cursor or stale >= 5:
            break
        time.sleep(1)
    if not out:
        sys.exit("fetched 0 bookmarks; refusing to overwrite bookmarks.json")
    with open("bookmarks.json", "w") as f:
        json.dump({"updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "count": len(out),
                   "bookmarks": list(out.values())}, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
