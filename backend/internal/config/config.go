package config

import "os"

type Config struct {
	Port   string
	DBPath string
}

func Load() Config {
	return Config{
		Port:   getenv("PORT", "8080"),
		DBPath: getenv("DB_PATH", "./data/app.db"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
