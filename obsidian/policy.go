package obsidian

import "time"

func applyPublicationPolicy(current map[string]candidate, localRoutes map[string]int, lastGood map[string]candidate, issues *map[string]Issue, now time.Time) (map[string]candidate, map[string]candidate) {
	grouped := make(map[string][]candidate)
	for _, parsed := range current {
		grouped[parsed.Entry.Slug] = append(grouped[parsed.Entry.Slug], parsed)
	}

	active := make(map[string]candidate)
	masked := make(map[string]candidate)
	for slug, candidates := range grouped {
		if len(candidates) != 1 {
			owner, ownerOK := collisionOwner(candidates, lastGood, localRoutes)
			for _, parsed := range candidates {
				if ownerOK && parsed.File.ID == owner.File.ID {
					if owner.Entry.IsDraft {
						masked[owner.Entry.Slug] = owner
					} else {
						active[owner.File.ID] = owner
					}
					if owner.File.Revision != parsed.File.Revision {
						issue := fileIssue(parsed.File, "last_known_good", "current revision is not publishable; retaining the last-known-good revision", now)
						issue.Route = owner.Entry.Slug
						issue.Fallback = "last_known_good_external"
						(*issues)[issue.Key] = issue
					}
					continue
				}
				issue := fileIssue(parsed.File, "route_collision", "multiple valid external files claim the same programming route", now)
				issue.Route = slug
				(*issues)[issue.Key] = issue
				addLastGoodFallback(parsed, lastGood, grouped, localRoutes, active, masked, issues, now)
			}
			continue
		}

		parsed := candidates[0]
		if parsed.Mode == "add" && localRoutes[slug] > 0 {
			issue := fileIssue(parsed.File, "route_collision", "additive entry collides with a local programming route", now)
			issue.Route = slug
			(*issues)[issue.Key] = issue
			addLastGoodFallback(parsed, lastGood, grouped, localRoutes, active, masked, issues, now)
			continue
		}
		if parsed.Mode == "overwrite" && localRoutes[slug] != 1 {
			issue := fileIssue(parsed.File, "overwrite_target", "overwrite entry has no matching local programming route", now)
			issue.Route = slug
			(*issues)[issue.Key] = issue
			addLastGoodFallback(parsed, lastGood, grouped, localRoutes, active, masked, issues, now)
			continue
		}

		if parsed.Entry.IsDraft {
			masked[slug] = parsed
			continue
		}
		active[parsed.File.ID] = parsed
	}

	return active, masked
}

func collisionOwner(candidates []candidate, lastGood map[string]candidate, localRoutes map[string]int) (candidate, bool) {
	var owner candidate
	for _, parsed := range candidates {
		previous, ok := lastGood[parsed.File.ID]
		if !ok || previous.Entry.Slug != parsed.Entry.Slug {
			continue
		}
		if owner.File.ID != "" {
			return candidate{}, false
		}
		owner = previous
	}
	if owner.File.ID == "" {
		return candidate{}, false
	}
	if candidatePublicationAllowed(owner, localRoutes) {
		return owner, true
	}
	previous := lastGood[owner.File.ID]
	if candidatePublicationAllowed(previous, localRoutes) {
		return previous, true
	}
	return candidate{}, false
}

func candidatePublicationAllowed(candidate candidate, localRoutes map[string]int) bool {
	if candidate.Mode == "add" {
		return localRoutes[candidate.Entry.Slug] == 0
	}
	return candidate.Mode == "overwrite" && localRoutes[candidate.Entry.Slug] == 1
}

func addLastGoodFallback(parsed candidate, lastGood map[string]candidate, grouped map[string][]candidate, localRoutes map[string]int, active, masked map[string]candidate, issues *map[string]Issue, now time.Time) {
	previous, ok := lastGood[parsed.File.ID]
	if !ok || !candidateAllowed(previous, grouped, localRoutes) {
		return
	}
	if previous.Entry.IsDraft {
		masked[previous.Entry.Slug] = previous
	} else {
		active[previous.File.ID] = previous
	}
	issue := fileIssue(parsed.File, "last_known_good", "current revision is not publishable; retaining the last-known-good revision", now)
	issue.Route = previous.Entry.Slug
	issue.Fallback = "last_known_good_external"
	(*issues)[issue.Key] = issue
}

func candidateAllowed(candidate candidate, grouped map[string][]candidate, localRoutes map[string]int) bool {
	for _, other := range grouped[candidate.Entry.Slug] {
		if other.File.ID != candidate.File.ID {
			return false
		}
	}
	return candidatePublicationAllowed(candidate, localRoutes)
}
