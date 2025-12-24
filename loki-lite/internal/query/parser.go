package query

import (
	"errors"
	"regexp"
	"strings"
)

var (
	ErrInvalidQuery = errors.New("invalid query syntax")
	// Matches {key="value", key2="value2"}
	queryRegex = regexp.MustCompile(`\{([^}]*)\}`)
	// Matches key="value"
	labelRegex = regexp.MustCompile(`(\w+)\s*=\s*"([^"]*)"`)
)

// ParseQuery parses a LogQL-style query string into label matchers
func ParseQuery(query string) (map[string]string, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return map[string]string{}, nil
	}

	// Extract content within braces
	matches := queryRegex.FindStringSubmatch(query)
	if len(matches) < 2 {
		return nil, ErrInvalidQuery
	}

	labelContent := matches[1]
	labels := make(map[string]string)

	// Parse individual label matchers
	labelMatches := labelRegex.FindAllStringSubmatch(labelContent, -1)
	for _, match := range labelMatches {
		if len(match) == 3 {
			key := strings.TrimSpace(match[1])
			value := strings.TrimSpace(match[2])
			labels[key] = value
		}
	}

	if len(labels) == 0 && len(labelContent) > 0 {
		return nil, ErrInvalidQuery
	}

	return labels, nil
}

// BuildQuery creates a query string from labels
func BuildQuery(labels map[string]string) string {
	if len(labels) == 0 {
		return "{}"
	}

	parts := make([]string, 0, len(labels))
	for k, v := range labels {
		parts = append(parts, k+`="`+v+`"`)
	}

	return "{" + strings.Join(parts, ", ") + "}"
}
